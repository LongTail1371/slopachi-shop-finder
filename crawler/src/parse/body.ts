import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';

export interface LoadedBody {
  $: CheerioAPI;
  body: Cheerio<Element>;
  title: string;
}

export function loadBody(html: string): LoadedBody {
  const $ = cheerio.load(html);
  // Try to find div#entry (contains store info) first, then fall back to div.entry.col-md-12, then body
  let body = $('div#entry');
  if (body.length === 0) {
    body = $('div.entry.col-md-12');
  }
  if (body.length === 0) {
    body = $('body');
  } else {
    body = body.first();
  }
  const title = $('title').first().text().replace(/\s*\|\s*スロパチステーション.*$/, '').trim();
  return { $, body, title };
}
