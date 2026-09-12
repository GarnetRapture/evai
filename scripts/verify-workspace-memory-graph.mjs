import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

try {
    const [{ buildMemoryGraph }, { getEverTalkLabels }, { DEFAULT_MEMORY_CONTEXT_FILTER }] = await Promise.all([
        vite.ssrLoadModule('/src/domains/evertalk/components/WorkspacePages.tsx'),
        vite.ssrLoadModule('/src/domains/evertalk/i18n.ts'),
        vite.ssrLoadModule('/src/domains/chat/memoryContext.ts'),
    ]);
    const unfiltered = { query: '', activeOnly: false, memoryContextFilter: DEFAULT_MEMORY_CONTEXT_FILTER };
    const packs = await Promise.all(['garnet.json', 'xiaolian.json'].map(async (file) =>
        JSON.parse(await readFile(path.join(root, 'data', 'personas', file), 'utf8'))));
    const allSpirits = packs.map((pack) => ({
        id: pack.id === '2120' ? 'xiaolian' : 'garnet',
        name: pack.name,
        name_en: pack.name_en,
        grade: pack.grade,
        race: pack.race,
        class: pack.class,
        sub_class: pack.sub_class,
        greeting: pack.personality.greeting,
        personality_override: null,
        raw_json: JSON.stringify(pack),
        created_at: '2026-09-13T00:00:00.000Z',
    }));
    const baseController = {
        allSpirits,
        appLanguage: 'ko',
        labels: getEverTalkLabels('ko'),
        bondRanking: [],
        familiarityList: [],
        storageInspection: { personas: [], native_statistics: null },
    };
    const emptyGraph = buildMemoryGraph(baseController, unfiltered);
    assert.equal(emptyGraph.nodes.filter((node) => node.kind === 'persona').length, 2);
    assert.equal(emptyGraph.edges.length, 0);

    const populatedController = {
        ...baseController,
        bondRanking: [{ persona_id: 'garnet', bond_score: 17, message_count: 7, memory_count: 2 }],
        familiarityList: [{ persona_id: 'garnet', familiarity_score: 17, message_count: 7, memory_count: 2 }],
        storageInspection: {
            native_statistics: null,
            personas: [{
                persona_id: 'garnet', message_count: 7, memory_count: 2, estimated_bytes: 1200,
                latest_activity_at: '2026-09-13T03:00:00.000Z',
                samples: [
                    { id: 'm1', kind: 'message', role_or_type: 'user', content: '오늘도 캐럿을 같이 꾸미자', created_at: '2026-09-13T03:00:00.000Z' },
                    { id: 'm2', kind: 'message', role_or_type: 'assistant', content: '구원자님과 함께라면 좋아요', created_at: '2026-09-13T03:01:00.000Z' },
                    { id: 'r1', kind: 'memory', role_or_type: 'directive', content: '캐럿을 함께 꾸미기로 했다', created_at: '2026-09-13T03:02:00.000Z' },
                ],
            }],
        },
    };
    const populatedGraph = buildMemoryGraph(populatedController, unfiltered);
    assert.ok(populatedGraph.nodes.length > emptyGraph.nodes.length, 'stored history must add graph nodes');
    assert.ok(populatedGraph.edges.length >= 7, 'stored history must add branched and feedback connections');
    assert.ok(populatedGraph.height > emptyGraph.height, 'data-derived branch rows must expand the canvas');
    assert.ok(populatedGraph.nodes.some((node) => node.kind === 'conversation' && node.description.includes('캐럿')));
    assert.ok(populatedGraph.nodes.some((node) => node.kind === 'memory' && node.title.includes('사용자 지시')));
    assert.ok(populatedGraph.edges.some((edge) => edge.feedback), 'summary must visibly feed the next persona turn');
    const directiveHiddenGraph = buildMemoryGraph(populatedController, { ...unfiltered, memoryContextFilter: { ...DEFAULT_MEMORY_CONTEXT_FILTER, directive: false } });
    assert.ok(!directiveHiddenGraph.nodes.some((node) => node.kind === 'memory' && node.title.includes('사용자 지시')), 'a disabled memory kind must be hidden from the graph');
    const activeOnlyGraph = buildMemoryGraph(populatedController, { ...unfiltered, activeOnly: true });
    assert.deepEqual([...new Set(activeOnlyGraph.nodes.map((node) => node.personaId))], ['garnet']);
    const searchedGraph = buildMemoryGraph(populatedController, { ...unfiltered, query: 'xiao' });
    assert.deepEqual([...new Set(searchedGraph.nodes.map((node) => node.personaId))], ['xiaolian']);

    console.log(JSON.stringify({
        workspace_memory_graph: 'passed',
        empty: { nodes: emptyGraph.nodes.length, edges: emptyGraph.edges.length, height: emptyGraph.height },
        populated: { nodes: populatedGraph.nodes.length, edges: populatedGraph.edges.length, height: populatedGraph.height },
        localized_memory_type: 'passed',
        summary_feedback_edge: 'passed',
        memory_kind_filter: 'passed',
        spirit_search_and_active_filter: 'passed',
    }, null, 2));
}
finally {
    await vite.close();
}
