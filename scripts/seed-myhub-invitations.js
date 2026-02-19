/**
 * Seed dummy myhub_invitations so the Hub rota detail page can show
 * invitation statuses (pending / accepted / declined).
 *
 * Run from project root:
 *   node scripts/seed-myhub-invitations.js           # use first rota in data/rotas.ndjson
 *   node scripts/seed-myhub-invitations.js <rotaId>  # use this rota (get ID from /hub/schedules/<rotaId>)
 *
 * Note: Only affects file store (data/myhub_invitations.ndjson). If your Hub uses
 * the database (DATA_STORE=database), create real invitations via the Hub: open a rota
 * and click "✉ Invite" for an occurrence.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { ulid } from 'ulid';

const DATA_DIR = join(process.cwd(), 'data');
const rotaIdArg = process.argv[2]; // optional: rota ID to seed for

function readNdjson(filePath) {
	return readFile(filePath, 'utf8')
		.then((raw) => raw.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)))
		.catch(() => []);
}

async function main() {
	const [rotas, contacts] = await Promise.all([
		readNdjson(join(DATA_DIR, 'rotas.ndjson')),
		readNdjson(join(DATA_DIR, 'contacts.ndjson'))
	]);

	let rota;
	if (rotaIdArg) {
		rota = rotas.find((r) => r.id === rotaIdArg);
		if (!rota) {
			console.error('Rota not found with id:', rotaIdArg);
			console.error('Available rotas (first 5):', rotas.slice(0, 5).map((r) => ({ id: r.id, role: r.role })));
			process.exit(1);
		}
	} else {
		rota = rotas.find((r) => r.occurrenceId) || rotas[0];
	}
	if (!rota) {
		console.error('No rotas found in data/rotas.ndjson');
		process.exit(1);
	}

	// Use 3 contacts (prefer not already on this rota so we see "invited" people)
	const assigneeIds = new Set(
		(rota.assignees || []).map((a) => (typeof a === 'string' ? a : a.contactId || a.id)).filter(Boolean)
	);
	const candidateContacts = contacts.filter((c) => c.id && !assigneeIds.has(c.id)).slice(0, 3);
	if (candidateContacts.length === 0) {
		console.error('No contacts available (or all are already assignees). Add more contacts or use a different rota.');
		process.exit(1);
	}

	const eventId = rota.eventId;
	const occurrenceId = rota.occurrenceId || null;
	const rotaId = rota.id;

	const statuses = ['pending', 'accepted', 'declined'];
	const invitations = candidateContacts.map((contact, i) => ({
		id: ulid(),
		contactId: contact.id,
		rotaId,
		eventId,
		occurrenceId,
		status: statuses[i] || 'pending',
		createdAt: new Date().toISOString(),
		respondedAt: statuses[i] !== 'pending' ? new Date().toISOString() : null
	}));

	const path = join(DATA_DIR, 'myhub_invitations.ndjson');
	const existing = await readNdjson(path).catch(() => []);
	const combined = [...existing, ...invitations];
	await writeFile(
		path,
		combined.map((r) => JSON.stringify(r)).join('\n') + '\n',
		'utf8'
	);

	console.log('Seed complete. Added', invitations.length, 'dummy myhub_invitations.');
	console.log('Rota:', rotaId, '| Role:', rota.role, '| Occurrence:', occurrenceId);
	console.log('Open /hub/schedules/' + rotaId, 'to see invitation statuses.');
	console.log('');
	console.log('If you still see no invitations in the Hub, your app may be using the database.');
	console.log('Then create them in the UI: open a rota → pick an occurrence → click "✉ Invite" and send to 1–2 contacts.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
