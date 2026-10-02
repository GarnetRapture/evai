import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDateTime } from '../../../../../src/domains/evertalk/logic';
import type { PersonaContextRelation, PersonaKeywordThread } from '../../chat';
import type { AndroidLabels } from '../labels';

const INLINE_SEPARATOR = ' ';

export interface MemoryKeywordDetailProps {
    thread: PersonaKeywordThread;
    spiritName: string;
    labels: AndroidLabels;
}

export interface MemoryRelationDetailProps {
    relation: PersonaContextRelation;
    labels: AndroidLabels;
}

interface MemoryDetailBadgeProps {
    tone: 'query' | 'recent' | null;
    children: ReactNode;
}

function MemoryDetailBadge({ tone, children }: MemoryDetailBadgeProps) {
    return (
        <View style={[styles.badge, tone === 'query' ? styles.badgeQuery : tone === 'recent' ? styles.badgeRecent : null]}>
            <Text style={[styles.badgeText, tone === 'query' ? styles.badgeTextQuery : tone === 'recent' ? styles.badgeTextRecent : null]}>{children}</Text>
        </View>
    );
}

export function MemoryKeywordDetail({ thread, spiritName, labels }: MemoryKeywordDetailProps) {
    const { keyword, episodes } = thread;
    return (
        <View style={styles.detail}>
            <Text accessibilityRole="header" style={styles.title}>{labels.memoryKeywordDetailTitle(keyword.token)}</Text>
            <Text style={styles.stats}>
                {labels.memoryKeywordStats(keyword.user_count, keyword.spirit_count, formatDateTime(keyword.first_seen_at, labels), formatDateTime(keyword.last_seen_at, labels))}
            </Text>
            <View style={styles.badges}>
                {keyword.query_match ? <MemoryDetailBadge tone="query">{labels.memoryKeywordQueryMatch}</MemoryDetailBadge> : null}
                {keyword.recent_count > 0 ? <MemoryDetailBadge tone="recent">{labels.memoryKeywordRecent(keyword.recent_count)}</MemoryDetailBadge> : null}
            </View>
            {episodes.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>{labels.memoryKeywordNoEpisodes}</Text>
                </View>
            ) : (
                <View style={styles.episodes}>
                    {episodes.map((episode) => (
                        <View key={episode.memory_id} style={styles.episode}>
                            <Text style={styles.episodeTime}>{formatDateTime(episode.occurred_at, labels)}</Text>
                            <Text style={styles.episodeText}>
                                <Text style={styles.episodeSpeaker}>{labels.memoryKeywordSavior}</Text>
                                {INLINE_SEPARATOR}
                                {episode.user_text}
                            </Text>
                            <Text style={styles.episodeText}>
                                <Text style={styles.episodeSpeaker}>{spiritName}</Text>
                                {INLINE_SEPARATOR}
                                {episode.spirit_action.length > 0 ? <Text style={styles.episodeAction}>({episode.spirit_action}){INLINE_SEPARATOR}</Text> : null}
                                {episode.spirit_messages.join(' ')}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

export function MemoryRelationDetail({ relation, labels }: MemoryRelationDetailProps) {
    const { relation: evidence, rival } = relation;
    const addressForm = evidence.address_forms.at(0) ?? null;
    return (
        <View style={styles.detail}>
            <Text accessibilityRole="header" style={styles.title}>{labels.memoryRivalDetailTitle(evidence.name)}</Text>
            <Text style={styles.stats}>{labels.memoryRelationCanonStats(evidence.interaction_count, evidence.mention_count)}</Text>
            <Text style={styles.stats}>
                {relation.savior_familiarity_level === null
                    ? labels.memoryRelationNoSaviorBond
                    : labels.memoryRelationSaviorBond(relation.savior_familiarity_level, relation.savior_message_count)}
            </Text>
            <Text style={styles.stats}>
                {rival !== null && rival.user_message_count > 0
                    ? labels.memoryRivalStats(rival.user_message_count, rival.spirit_message_count, formatDateTime(rival.first_user_at, labels), formatDateTime(rival.latest_user_at, labels))
                    : labels.memoryRivalNoContact}
            </Text>
            <View style={styles.badges}>
                {rival?.mentioned_now === true ? <MemoryDetailBadge tone="query">{labels.memoryRivalMentionedNow}</MemoryDetailBadge> : null}
                {rival !== null && rival.spoke_of_you_count > 0 ? <MemoryDetailBadge tone="recent">{labels.memoryRivalSpokeOfYou(rival.spoke_of_you_count)}</MemoryDetailBadge> : null}
                {evidence.shared_union !== null ? <MemoryDetailBadge tone={null}>{labels.memoryRivalSharedUnion(evidence.shared_union)}</MemoryDetailBadge> : null}
                {addressForm !== null ? <MemoryDetailBadge tone={null}>{labels.memoryRivalCanonBond(addressForm)}</MemoryDetailBadge> : null}
            </View>
            {evidence.self_remarks.length > 0 ? (
                <View style={styles.remark}>
                    <Text style={styles.remarkText}>{evidence.self_remarks[0]}</Text>
                </View>
            ) : null}
            {rival !== null && rival.topics.length > 0 ? (
                <View style={styles.topics}>
                    <Text style={styles.topicsTitle}>{labels.memoryRivalTopics}</Text>
                    <View style={styles.topicList}>
                        {rival.topics.map((topic) => (
                            <View key={topic} style={styles.topic}>
                                <Text style={styles.topicText}>{topic}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    detail: {
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#4c4962',
        borderRadius: 14,
        backgroundColor: '#2f2e41',
    },
    title: {
        color: '#e9e5f3',
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '400',
    },
    stats: {
        color: '#bdb7cc',
        fontSize: 13,
        lineHeight: 19.5,
    },
    badges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    badge: {
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderRadius: 999,
    },
    badgeQuery: {
        borderColor: '#f09bbf',
    },
    badgeRecent: {
        borderColor: '#b98fe0',
    },
    badgeText: {
        color: '#e2dcef',
        fontSize: 12,
        lineHeight: 18,
    },
    badgeTextQuery: {
        color: '#f7c3da',
    },
    badgeTextRecent: {
        color: '#dcc6f2',
    },
    empty: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#4c4962',
        borderRadius: 14,
    },
    emptyText: {
        color: '#bdb7cc',
        fontSize: 14,
        lineHeight: 21,
    },
    episodes: {
        gap: 8,
    },
    episode: {
        gap: 4,
        padding: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.18)',
    },
    episodeTime: {
        color: '#9e98b1',
        fontSize: 11,
        lineHeight: 16.5,
    },
    episodeText: {
        color: '#e9e5f3',
        fontSize: 13,
        lineHeight: 19.5,
    },
    episodeSpeaker: {
        color: '#f1bfd3',
        fontWeight: '700',
    },
    episodeAction: {
        color: '#c9b8ec',
        fontStyle: 'normal',
    },
    remark: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderLeftWidth: 3,
        borderLeftColor: '#d9b36a',
        backgroundColor: 'rgba(217, 179, 106, 0.1)',
    },
    remarkText: {
        color: '#efe3c4',
        fontSize: 13,
        lineHeight: 19.5,
    },
    topics: {
        gap: 6,
    },
    topicsTitle: {
        color: '#e9e5f3',
        fontSize: 13,
        lineHeight: 19.5,
        fontWeight: '700',
    },
    topicList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    topic: {
        paddingVertical: 2,
        paddingHorizontal: 9,
        borderRadius: 6,
        backgroundColor: 'rgba(224, 161, 90, 0.18)',
    },
    topicText: {
        color: '#f3d2a8',
        fontSize: 13,
        lineHeight: 19.5,
    },
});
