import { Dialect, KanjiResult, LangSource } from '@birchill/jpdict-idb';
import browser from 'webextension-polyfill';

import { NameResult, Sense, WordResult } from '../background/search-result';
import { CopyType } from '../common/copy-keys';
import {
  getReferenceValue,
  getSelectedReferenceLabels,
  ReferenceAbbreviation,
} from '../common/refs';

export type CopyEntry =
  | { type: 'word'; data: WordResult }
  | { type: 'name'; data: NameResult }
  | { type: 'kanji'; data: KanjiResult };

type Headword = WordResult['k'][0] | WordResult['r'][0];

export function getTextToCopy({
  entry,
  copyType,
  kanjiReferences = [] as Array<ReferenceAbbreviation>,
  showKanjiComponents = true,
}: {
  entry: CopyEntry;
  copyType: CopyType;
  kanjiReferences?: Array<ReferenceAbbreviation>;
  showKanjiComponents?: boolean;
}): string {
  switch (copyType) {
    case 'entry':
      return getEntryToCopy(entry, {
        kanjiReferences,
        showKanjiComponents,
      });

    case 'tab':
      return getFieldsToCopy(entry, {
        kanjiReferences,
        showKanjiComponents,
      });

    case 'word':
      return getWordToCopy(entry);
  }
}

export function getWordToCopy(entry: CopyEntry): string {
  let result: string;

  switch (entry.type) {
    case 'word':
      {
        let headwords: Headword[] =
          entry.data.k && entry.data.k.length
            ? entry.data.k.filter((k) => !k.i?.includes('sK'))
            : entry.data.r.filter((r) => !r.i?.includes('sk'));

        // Only show matches -- unless our only matches were search-only
        // terms -- in which case we want to include all headwords.
        if (headwords.some((h) => h.match)) {
          headwords = headwords.filter((entry) => entry.match);
        }

        result = headwords.map((entry) => entry.ent).join(', ');
      }
      break;

    case 'name':
      result = (entry.data.k || entry.data.r).join(', ');
      break;

    case 'kanji':
      result = entry.data.c;
      break;
  }

  return result!;
}

export function getEntryToCopy(
  entry: CopyEntry,
  {
    kanjiReferences = [] as Array<ReferenceAbbreviation>,
    showKanjiComponents = true,
  }: {
    kanjiReferences?: Array<ReferenceAbbreviation>;
    showKanjiComponents?: boolean;
  } = {}
): string {
  let result: string;

  switch (entry.type) {
    case 'word':
      {
        const kanjiHeadwords = entry.data.k
          ? entry.data.k.filter((k) => !k.i?.includes('sK')).map((k) => k.ent)
          : [];
        const kanaHeadwords = entry.data.r
          .filter((r) => !r.i?.includes('sk'))
          .map((r) => r.ent);

        result = kanjiHeadwords.length
          ? `${kanjiHeadwords.join(', ')} [${kanaHeadwords.join(', ')}]`
          : kanaHeadwords.join(', ');
        if (entry.data.romaji?.length) {
          result += ` (${entry.data.romaji.join(', ')})`;
        }

        result += ' ' + serializeDefinition(entry.data);
      }
      break;

    case 'name':
      result = entry.data.k
        ? `${entry.data.k.join(', ')} [${entry.data.r.join(', ')}]`
        : entry.data.r.join(', ');

      for (const [i, tr] of entry.data.tr.entries()) {
        if (i) {
          result += '; ';
        }
        if (tr.type) {
          result += ` (${tr.type.join(', ')})`;
        }
        result += ' ' + tr.det.join(', ');
      }
      break;

    case 'kanji':
      {
        const { c, r, m, rad, comp } = entry.data;

        result = c;
        const readings = getKanjiReadings(entry.data);
        if (readings) {
          result += ` [${readings}]`;
        }
        if (r.na && r.na.length) {
          result += ` (${r.na.join('、')})`;
        }
        result += ` ${m.join(', ')}`;
        const radicalLabel = browser.i18n.getMessage(
          'content_kanji_radical_label'
        );
        result += `; ${radicalLabel}: ${rad.b || rad.k}（${rad.na.join(
          '、'
        )}）`;
        if (rad.base) {
          const baseChar = (rad.base.b || rad.base.k)!;
          const baseReadings = rad.base.na.join('、');
          result +=
            ' ' +
            browser.i18n.getMessage('content_kanji_base_radical', [
              baseChar,
              baseReadings,
            ]);
        }
        if (showKanjiComponents && comp.length) {
          const componentsLabel = browser.i18n.getMessage(
            'content_kanji_components_label'
          );
          const components: Array<string> = [];
          for (const component of comp) {
            components.push(
              `${component.c} (${
                component.na.length ? component.na[0] + ', ' : ''
              }${component.m.length ? component.m[0] : ''})`
            );
          }
          result += `; ${componentsLabel}: ${components.join(', ')}`;
        }

        if (kanjiReferences.length) {
          const labels = getSelectedReferenceLabels(kanjiReferences);
          for (const label of labels) {
            if (
              label.ref === 'nelson_r' &&
              !rad.nelson &&
              kanjiReferences.includes('radical')
            ) {
              continue;
            }
            result += `; ${label.short || label.full} ${
              getReferenceValue(entry.data, label.ref) || '-'
            }`;
          }
        }
      }
      break;
  }

  return result!;
}

function serializeDefinition(entry: WordResult): string {
  const senses = entry.s;
  if (senses.length > 1) {
    const nativeSenses = senses
      .filter((s) => s.lang && s.lang !== 'en')
      .map((s) => `• ${serializeSense(s)}`);
    const enSenses = senses
      .filter((s) => !s.lang || s.lang === 'en')
      .map((s, index) => `(${index + 1}) ${serializeSense(s)}`);

    return [...nativeSenses, ...enSenses].join(' ');
  } else {
    return serializeSense(senses[0]);
  }
}

// Match the formatting in Edict
const dialects: { [dial in Dialect]: string } = {
  bra: 'bra:',
  ho: 'hob:',
  tsug: 'tsug:',
  th: 'thb:',
  na: 'nab:',
  kt: 'ktb:',
  ks: 'ksb:',
  ky: 'kyb:',
  os: 'osb:',
  ts: 'tsb:',
  '9s': 'kyu:',
  ok: 'rkb:',
};

function serializeSense(sense: Sense): string {
  let result = '';

  result += sense.pos ? `(${sense.pos.join(',')}) ` : '';
  result += sense.field ? `(${sense.field.join(',')}) ` : '';
  result += sense.misc ? `(${sense.misc.join(',')}) ` : '';
  result += sense.dial
    ? `(${sense.dial
        .map((dial) => (dial in dialects ? dialects[dial as Dialect] : dial))
        .join(',')}) `
    : '';

  const glosses: Array<string> = [];
  for (const g of sense.g) {
    let gloss = '';
    if (g.type && g.type !== 'tm' && g.type !== 'none') {
      const glossTypeStr = browser.i18n.getMessage(
        `gloss_type_short_${g.type}`
      );
      if (glossTypeStr) {
        gloss = `(${glossTypeStr}) `;
      }
    }
    gloss += g.str;
    if (g.type === 'tm') {
      gloss += '™';
    }
    glosses.push(gloss);
  }
  result += glosses.join('; ');

  result += sense.lsrc
    ? ` (${sense.lsrc.map(serializeLangSrc).join(', ')})`
    : '';
  result += sense.inf ? ` (${sense.inf})` : '';

  return result;
}

function serializeLangSrc(lsrc: LangSource) {
  const lang = lsrc.wasei ? 'wasei' : lsrc.lang;
  const parts = [];
  if (lang) {
    parts.push(lang);
  }
  if (lsrc.src) {
    parts.push(lsrc.src);
  }
  return parts.join(': ');
}

export function getFieldsToCopy(
  entry: CopyEntry,
  {
    kanjiReferences = [] as Array<ReferenceAbbreviation>,
    showKanjiComponents = true,
  }: {
    kanjiReferences?: Array<ReferenceAbbreviation>;
    showKanjiComponents?: boolean;
  } = {}
): string {
  let result: string;

  switch (entry.type) {
    case 'word':
      result =
        entry.data.k && entry.data.k.length
          ? entry.data.k
              .filter((k) => !k.i?.includes('sK'))
              .map((k) => k.ent)
              .join('; ')
          : '';
      result +=
        '\t' +
        entry.data.r
          .filter((r) => !r.i?.includes('sk'))
          .map((r) => r.ent)
          .join('; ');
      if (entry.data.romaji?.length) {
        result += '\t' + entry.data.romaji.join('; ');
      }

      result += '\t' + serializeDefinition(entry.data);
      break;

    case 'name':
      {
        let definition = '';
        for (const [i, tr] of entry.data.tr.entries()) {
          if (i) {
            definition += '; ';
          }
          if (tr.type) {
            definition += `(${tr.type.join(', ')}) `;
          }
          definition += tr.det.join(', ');
        }

        // Split each kanji name out into a separate row
        result = '';
        for (const [i, kanji] of (entry.data.k || ['']).entries()) {
          if (i) {
            result += '\n';
          }
          result += `${kanji}\t${entry.data.r.join(', ')}\t${definition}`;
        }
      }
      break;

    case 'kanji':
      {
        const { c, r, m, comp } = entry.data;

        result = c;
        const readings = getKanjiReadings(entry.data);
        result += `\t${readings}`;
        result += `\t${(r.na || []).join('、')}`;
        result += `\t${m.join(', ')}`;
        if (showKanjiComponents) {
          const components = comp.map((comp) => comp.c).join('');
          result += `\t${components}`;
        }
        if (kanjiReferences.length) {
          const labels = getSelectedReferenceLabels(kanjiReferences);
          for (const label of labels) {
            // For some common types we don't produce the label
            switch (label.ref) {
              case 'radical':
              case 'unicode':
              case 'nelson_r':
                // All the above types also either always exist (radical,
                // unicode) or if they don't exist we want to produce an empty
                // value (not '-') hence why we don't include the ... || '-'
                // from the next block.
                result += '\t' + getReferenceValue(entry.data, label.ref);
                break;

              default:
                result += `\t${label.short || label.full} ${
                  getReferenceValue(entry.data, label.ref) || '-'
                }`;
                break;
            }
          }
        }
      }
      break;
  }

  return result!;
}

function getKanjiReadings(kanji: KanjiResult): string {
  return [
    ...(kanji.r.on ? kanji.r.on : []),
    ...(kanji.r.kun ? kanji.r.kun : []),
  ].join('、');
}
