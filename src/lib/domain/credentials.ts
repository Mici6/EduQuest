import crypto from "node:crypto";
import type { Actor } from "../auth/types";
import { forbidden, notFound } from "../auth/errors";
import { sealMatches, sealSignature } from "../auth/token";
import type { Db } from "../db/client";
import { json } from "../db/client";
import { nowTs } from "../utils/dates";
import { audit } from "./audit";

/**
 * School-sealed documents (Skills Passport, course certificates,
 * recommendation letters). Each is a frozen JSON snapshot plus an HMAC seal
 * over every field, so the public verification page can show whether a
 * document is genuine, revoked, or was altered after issue.
 */

export type CredentialKind = "passport" | "course_certificate" | "recommendation";

type Row = {
  id: string;
  school_id: string;
  student_id: string;
  kind: CredentialKind;
  title: string;
  payload: string;
  signature: string;
  issued_by: string | null;
  issued_at: string;
  revoked_at: string | null;
};

const sealed = (r: Omit<Row, "signature" | "revoked_at">) =>
  JSON.stringify([r.id, r.school_id, r.student_id, r.kind, r.title, r.payload, r.issued_by, r.issued_at]);

export function issueCredential(
  db: Db,
  input: { schoolId: string; studentId: string; kind: CredentialKind; title: string; payload: Record<string, unknown>; issuedBy: string | null },
  now = new Date(),
): string {
  // Unguessable: the link itself is what the student shares.
  const row = {
    id: crypto.randomBytes(12).toString("base64url"),
    school_id: input.schoolId,
    student_id: input.studentId,
    kind: input.kind,
    title: input.title.slice(0, 200),
    payload: JSON.stringify(input.payload),
    issued_by: input.issuedBy,
    issued_at: nowTs(now),
  };
  db.run(
    `INSERT INTO credentials (id, school_id, student_id, kind, title, payload, signature, issued_by, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.school_id,
    row.student_id,
    row.kind,
    row.title,
    row.payload,
    sealSignature(sealed(row)),
    row.issued_by,
    row.issued_at,
  );
  audit(db, input.issuedBy ?? input.studentId, `credential.issue.${input.kind}`, "credential", row.id);
  return row.id;
}

export type VerifiedCredential = {
  id: string;
  kind: CredentialKind;
  title: string;
  payload: Record<string, unknown>;
  issuedAt: string;
  revokedAt: string | null;
  issuerName: string | null;
  issuerTitle: string | null;
  schoolName: string;
  schoolCity: string | null;
  status: "valid" | "revoked" | "tampered";
};

/** Public lookup for /verify/[id]. Returns null for unknown ids. */
export function verifyCredential(db: Db, id: string): VerifiedCredential | null {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return null;
  const r = db.get<Row & { school_name: string; school_city: string | null; issuer_name: string | null; issuer_title: string | null }>(
    `SELECT c.*, s.name school_name, s.city school_city, u.display_name issuer_name, u.title issuer_title
     FROM credentials c JOIN schools s ON s.id = c.school_id LEFT JOIN users u ON u.id = c.issued_by WHERE c.id = ?`,
    id,
  );
  if (!r) return null;
  const intact = sealMatches(sealed(r), r.signature);
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    payload: json<Record<string, unknown>>(r.payload, {}),
    issuedAt: r.issued_at,
    revokedAt: r.revoked_at,
    issuerName: r.issuer_name,
    issuerTitle: r.issuer_title,
    schoolName: r.school_name,
    schoolCity: r.school_city,
    status: !intact ? "tampered" : r.revoked_at ? "revoked" : "valid",
  };
}

export function credentialsForStudent(db: Db, studentId: string) {
  return db.all<{ id: string; kind: CredentialKind; title: string; issued_at: string; revoked_at: string | null; issuer_name: string | null }>(
    `SELECT c.id, c.kind, c.title, c.issued_at, c.revoked_at, u.display_name issuer_name
     FROM credentials c LEFT JOIN users u ON u.id = c.issued_by WHERE c.student_id = ? ORDER BY c.issued_at DESC, c.rowid DESC`,
    studentId,
  );
}

/**
 * Revoke a document. The student may withdraw their own passports; the
 * issuing teacher may withdraw their letters; admins may revoke anything
 * from their school. Revoked documents stay visible as "revoked" so old
 * links can't be mistaken for valid ones.
 */
export function revokeCredential(db: Db, actor: Actor, id: string) {
  const r = db.get<Row>(`SELECT * FROM credentials WHERE id = ?`, id);
  if (!r || r.school_id !== actor.schoolId) throw notFound();
  const allowed =
    actor.role === "admin" ||
    (actor.role === "student" && r.kind === "passport" && r.student_id === actor.id) ||
    (actor.role === "teacher" && r.kind === "recommendation" && r.issued_by === actor.id);
  if (!allowed) throw forbidden();
  db.run(`UPDATE credentials SET revoked_at = COALESCE(revoked_at, datetime('now')) WHERE id = ?`, id);
  audit(db, actor.id, `credential.revoke.${r.kind}`, "credential", id);
}
