/**
 * Seed dummy myhub_invitations into the local Postgres database so the Hub
 * rota detail page shows invitation statuses (pending / accepted / declined).
 *
 * Uses DATABASE_URL from .env. Run from project root:
 *   node scripts/seed-myhub-invitations-db.js
 *   node scripts/seed-myhub-invitations-db.js <rotaId>   # seed for this rota only
 *
 * Picks a rota (optionally the one you pass) and 3 contacts from the same org,
 * inserts 3 invitations with statuses pending, accepted, declined.
 */

import pg from 'pg';
import { config as loadEnv } from 'dotenv';
import { ulid } from 'ulid';

loadEnv();

const TABLE_NAME = 'crm_records';
const EGCC_ORG_ID = '01KGNCSXHK6YNPEBCFMKH2VEQ7'; // Eltham Green Community Church

function rowToRecord(row) {
	const rec = { ...row.body, id: row.id };
	if (row.created_at) rec.createdAt = row.created_at;
	if (row.updated_at) rec.updatedAt = row.updated_at;
	return rec;
}

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error('DATABASE_URL is not set. Create a .env with DATABASE_URL for your local Postgres.');
		process.exit(1);
	}

	const pool = new pg.Pool({
		connectionString: databaseUrl,
		ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false }
	});

	const rotaIdArg = process.argv[2];

	try {
		// Load rotas for EGCC (or all if no org filter)
		const rotasRes = await pool.query(
			`SELECT id, body, created_at, updated_at FROM ${TABLE_NAME}
			 WHERE collection = 'rotas'
			 AND (body->>'organisationId' = $1 OR body->>'organisationId' IS NULL)
			 ORDER BY created_at ASC`,
			[EGCC_ORG_ID]
		);
		const rotas = rotasRes.rows.map(rowToRecord);

		if (rotas.length === 0) {
			console.error('No rotas found for this organisation. Try without org filter or check DATABASE_URL.');
			const all = await pool.query(`SELECT id, body FROM ${TABLE_NAME} WHERE collection = 'rotas' LIMIT 3`);
			if (all.rows.length) {
				console.error('Sample rota ids in DB:', all.rows.map((r) => r.id));
			}
			process.exit(1);
		}

		let rota;
		if (rotaIdArg) {
			rota = rotas.find((r) => r.id === rotaIdArg);
			if (!rota) {
				console.error('Rota not found:', rotaIdArg);
				console.error('Available:', rotas.slice(0, 5).map((r) => ({ id: r.id, role: r.role })));
				process.exit(1);
			}
		} else {
			rota = rotas.find((r) => r.occurrenceId) || rotas[0];
		}

		const eventId = rota.eventId;
		const occurrenceId = rota.occurrenceId || null;
		const rotaId = rota.id;

		// Assignee contact ids on this rota
		const assigneeIds = new Set(
			(rota.assignees || []).map((a) => (typeof a === 'string' ? a : a.contactId || a.id)).filter(Boolean)
		);

		// Load contacts (same org), exclude already on rota
		const contactsRes = await pool.query(
			`SELECT id, body, created_at, updated_at FROM ${TABLE_NAME}
			 WHERE collection = 'contacts'
			 AND (body->>'organisationId' = $1 OR body->>'organisationId' IS NULL)
			 ORDER BY created_at ASC`,
			[EGCC_ORG_ID]
		);
		const contacts = contactsRes.rows.map(rowToRecord).filter((c) => c.id && !assigneeIds.has(c.id));

		if (contacts.length < 3) {
			console.error('Need at least 3 contacts not already on this rota. Found:', contacts.length);
			process.exit(1);
		}

		const statuses = ['pending', 'accepted', 'declined'];
		const now = new Date().toISOString();

		for (let i = 0; i < 3; i++) {
			const contact = contacts[i];
			const status = statuses[i];
			const id = ulid();
			const body = {
				contactId: contact.id,
				rotaId,
				eventId,
				occurrenceId,
				status,
				respondedAt: status !== 'pending' ? now : null
			};
			await pool.query(
				`INSERT INTO ${TABLE_NAME} (collection, id, body, created_at, updated_at)
				 VALUES ('myhub_invitations', $1, $2::jsonb, $3, $4)
				 ON CONFLICT (collection, id) DO NOTHING`,
				[id, JSON.stringify(body), now, now]
			);
			console.log('  ', status, '→', (contact.firstName || '') + ' ' + (contact.lastName || '') || contact.email);
		}

		console.log('');
		console.log('Seed complete. Added 3 myhub_invitations to the database.');
		console.log('Rota:', rotaId, '| Role:', rota.role, '| Occurrence:', occurrenceId);
		console.log('Open /hub/schedules/' + rotaId, 'to see invitation statuses.');
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
