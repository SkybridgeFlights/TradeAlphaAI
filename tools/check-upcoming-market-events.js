'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const calendar = readJson('data/economic-calendar.json', { events: [] });
const queue = readJson('data/market-outlook-queue.json', { topics: [] });
const write = process.argv.includes('--write');
const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
const upcoming = (calendar.events || []).filter(isUpcomingConfirmed);

if (!upcoming.length) {
  console.log('No sourced upcoming market events found.');
  process.exit(0);
}

let tagged = 0;
for (const topic of queue.topics || []) {
  const text = normalize(`${topic.title_en} ${topic.category} ${topic.topic_cluster || ''} ${(topic.tags || []).join(' ')}`);
  const matched = upcoming.filter((event) => {
    const eventText = normalize(`${event.name} ${event.type} ${(event.tags || []).join(' ')}`);
    return eventText.split(' ').some((term) => term.length > 2 && text.includes(term));
  });
  if (!matched.length) continue;
  topic.event_tags = [...new Set([...(topic.event_tags || []), ...matched.map((event) => event.type)])];
  topic.event_context = matched.map((event) => ({ id: event.id, name: event.name, date: event.date, source_url: event.source_url }));
  tagged += 1;
}

if (write && tagged) {
  queue.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(ROOT, 'data', 'market-outlook-queue.json'), JSON.stringify(queue, null, 2) + '\n', 'utf8');
}

console.log(`Upcoming sourced events: ${upcoming.length}; outlook topics tagged: ${tagged}${write ? '' : ' (dry run)'}.`);

function isUpcomingConfirmed(event) {
  if (!event.source_url || event.status !== 'confirmed') return false;
  const date = new Date(`${event.date}T00:00:00Z`);
  const days = (date - today) / 86400000;
  return days >= 0 && days <= 14;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function readJson(rel, fallback) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}
