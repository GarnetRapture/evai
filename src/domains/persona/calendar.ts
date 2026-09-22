import type { AppLanguage } from '../../shared/types';
import { isSaviorSpeaker } from './dialogue';
import type { EdenHoliday, LocalizedDialogue, PersonaHolidayReference, PersonaLanguageSlice } from './types';

export const EDEN_HOLIDAYS: readonly EdenHoliday[] = [
    {
        id: 'new_year',
        names: { ko: ['새해', '신년'], en: ['New Year'], zh_cn: ['新年'] },
        month_days: [[1, 1]],
    },
    {
        id: 'love_day',
        names: { ko: ['사랑의 날'], en: ['Love Day'], zh_cn: ['恋爱之日'] },
        month_days: [[2, 14]],
    },
    {
        id: 'memory_day',
        names: { ko: ['기억의 날', '할로윈'], en: ['Memory Day', 'Halloween'], zh_cn: ['记忆之日', '万圣节'] },
        month_days: [[10, 31]],
    },
    {
        id: 'eve_day',
        names: { ko: ['이브 데이', '이브의 날', '이브데이'], en: ["Eve's Day", 'Eve Day'], zh_cn: ['夏娃之日'] },
        month_days: [[12, 24], [12, 25]],
    },
    {
        id: 'knowledge_day',
        names: { ko: ['지식의 날'], en: ['Knowledge Day'], zh_cn: ['知识之日'] },
        month_days: [],
    },
    {
        id: 'martial_arts_day',
        names: { ko: ['무예의 날'], en: ['Martial Arts Day'], zh_cn: ['武术之日'] },
        month_days: [],
    },
];

const HOLIDAY_LINE_LIMIT = 6;

export function resolveEdenHolidaysOn(occurredAt: string): EdenHoliday[] {
    const date = new Date(occurredAt);
    if (Number.isNaN(date.getTime())) {
        return [];
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return EDEN_HOLIDAYS.filter((holiday) => holiday.month_days.some(([holidayMonth, holidayDay]) => holidayMonth === month && holidayDay === day));
}

export function findMentionedEdenHolidays(text: string, language: AppLanguage): EdenHoliday[] {
    const lowered = text.toLocaleLowerCase();
    return EDEN_HOLIDAYS.filter((holiday) => holiday.names[language].some((name) => lowered.includes(name.toLocaleLowerCase())));
}

function spiritRunAround(entries: readonly LocalizedDialogue[], index: number, spiritName: string, language: AppLanguage): string[] {
    const lines: string[] = [];
    for (let cursor = index; cursor < entries.length && lines.length < HOLIDAY_LINE_LIMIT; cursor += 1) {
        const entry = entries[cursor];
        if (isSaviorSpeaker(entry.speaker, language) || entry.speaker !== spiritName) {
            break;
        }
        lines.push(entry.message);
    }
    return lines;
}

export function collectPersonaHolidayReference(slice: PersonaLanguageSlice, holiday: EdenHoliday, language: AppLanguage): PersonaHolidayReference {
    const names = holiday.names[language].map((name) => name.toLocaleLowerCase());
    const lines: string[] = [];
    const entries = [...slice.story, ...slice.evertalk];
    for (let index = 0; index < entries.length && lines.length < HOLIDAY_LINE_LIMIT; index += 1) {
        const entry = entries[index];
        if (entry.speaker !== slice.name || !names.some((name) => entry.message.toLocaleLowerCase().includes(name))) {
            continue;
        }
        for (const line of spiritRunAround(entries, index, slice.name, language)) {
            if (!lines.includes(line) && lines.length < HOLIDAY_LINE_LIMIT) {
                lines.push(line);
            }
        }
    }
    return { holiday_id: holiday.id, name: holiday.names[language][0], spirit_lines: lines };
}
