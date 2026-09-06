import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(
  path.join(__dirname, '../../../supabase/migrations/0002_capture_sweep_cron.sql'),
  'utf8'
);

describe('0002_capture_sweep_cron.sql', () => {
  it('enables pg_cron and pg_net', () => {
    expect(sql).toMatch(/create extension if not exists pg_cron/);
    expect(sql).toMatch(/create extension if not exists pg_net/);
  });

  it('schedules a named job that calls the capture-sweep function', () => {
    expect(sql).toMatch(/cron\.schedule\(\s*'mocha-capture-sweep'/);
    expect(sql).toMatch(/net\.http_post/);
    expect(sql).toMatch(/\/functions\/v1\/capture-sweep/);
  });
});
