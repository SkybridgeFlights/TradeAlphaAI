'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const days = Number(argValue('--days') || 45);
const statusFilter = argValue('--status');
const now = new Date();
const horizon = new Date(now.getTime() + days * 86400000);
const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));

const items = (queue.topics || [])
  .filter((topic) => topic.target_publish_date)
  .filter((topic) => !statusFilter || topic.status === statusFilter)
  .filter((topic) => {
    const date = new Date(`${topic.target_publish_date}T00:00:00Z`);
    return date >= new Date('2026-01-01T00:00:00Z') && date <= horizon;
  })
  .sort((a, b) => String(a.target_publish_date).localeCompare(String(b.target_publish_date)) || score(b) - score(a));

if (!items.length) {
  console.log('No upcoming editorial topics found.');
  process.exit(0);
}

console.log(`Upcoming editorial publications (${items.length})`);
for (const topic of items) {
  const time = topic.scheduled_publish_time || '--:--';
  const review = topic.review_status || 'not_started';
  const telegram = topic.telegram_status || 'not_ready';
  console.log(`${topic.target_publish_date} ${time} | ${topic.status} | ${topic.category} | ${topic.slug}`);
  console.log(`  ${topic.title_en}`);
  console.log(`  review=${review} telegram=${telegram} priority=${score(topic)} cluster=${topic.discovery_cluster || 'n/a'}`);
}

function score(topic) {
  return Number(topic.priority_score || topic.priority || 0);
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}
