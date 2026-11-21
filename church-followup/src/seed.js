// Loads a few demo visitors so you can see the dashboard working immediately.
// Run with: npm run seed
import { checkIn } from './db.js';

const demo = [
  { name: 'Ada Obi', phone: '08031112222', email: 'ada@example.com', howHeard: 'A friend or family member' },
  { name: 'Emeka Nwosu', phone: '07065550000', howHeard: 'Walked / drove past' },
  { name: 'Blessing Okafor', phone: '09011223344', email: 'blessing@example.com', howHeard: 'Social media' },
];

for (const d of demo) checkIn({ ...d, service: 'First Service' });

// Make one of them a returning visitor (same phone checks in again).
checkIn({ name: 'Ada Obi', phone: '08031112222', service: 'First Service' });

console.log('Seeded 3 people (Ada is a returning visitor). Open /dashboard to see them.');
