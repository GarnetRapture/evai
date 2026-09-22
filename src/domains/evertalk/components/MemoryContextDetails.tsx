import { formatDateTime } from '../logic';
import type { MemoryKeywordDetailProps, MemoryRelationDetailProps } from '../types';

export function MemoryKeywordDetail({ thread, spiritName, labels }: MemoryKeywordDetailProps) {
    const { keyword, episodes } = thread;
    return (
        <article className="ever-memory-detail">
            <h3>{labels.memoryKeywordDetailTitle(keyword.token)}</h3>
            <p className="ever-memory-detail__stats">
                {labels.memoryKeywordStats(keyword.user_count, keyword.spirit_count, formatDateTime(keyword.first_seen_at, labels), formatDateTime(keyword.last_seen_at, labels))}
            </p>
            <div className="ever-memory-detail__badges">
                {keyword.query_match ? <span className="is-query">{labels.memoryKeywordQueryMatch}</span> : null}
                {keyword.recent_count > 0 ? <span className="is-recent">{labels.memoryKeywordRecent(keyword.recent_count)}</span> : null}
            </div>
            {episodes.length === 0 ? <p className="ever-memory-detail__empty">{labels.memoryKeywordNoEpisodes}</p> : (
                <ol className="ever-memory-detail__episodes">
                    {episodes.map((episode) => (
                        <li key={episode.memory_id}>
                            <time>{formatDateTime(episode.occurred_at, labels)}</time>
                            <p><b>{labels.memoryKeywordSavior}</b>{episode.user_text}</p>
                            <p>
                                <b>{spiritName}</b>
                                {episode.spirit_action.length > 0 ? <em>({episode.spirit_action})</em> : null}
                                {episode.spirit_messages.join(' ')}
                            </p>
                        </li>
                    ))}
                </ol>
            )}
        </article>
    );
}

export function MemoryRelationDetail({ relation, labels }: MemoryRelationDetailProps) {
    const { relation: evidence, rival } = relation;
    const addressForm = evidence.address_forms[0] ?? null;
    return (
        <article className="ever-memory-detail">
            <h3>{labels.memoryRivalDetailTitle(evidence.name)}</h3>
            <p className="ever-memory-detail__stats">{labels.memoryRelationCanonStats(evidence.interaction_count, evidence.mention_count)}</p>
            <p className="ever-memory-detail__stats">
                {relation.savior_familiarity_level === null
                    ? labels.memoryRelationNoSaviorBond
                    : labels.memoryRelationSaviorBond(relation.savior_familiarity_level, relation.savior_message_count)}
            </p>
            <p className="ever-memory-detail__stats">
                {rival !== null && rival.user_message_count > 0
                    ? labels.memoryRivalStats(rival.user_message_count, rival.spirit_message_count, formatDateTime(rival.first_user_at, labels), formatDateTime(rival.latest_user_at, labels))
                    : labels.memoryRivalNoContact}
            </p>
            <div className="ever-memory-detail__badges">
                {rival?.mentioned_now === true ? <span className="is-query">{labels.memoryRivalMentionedNow}</span> : null}
                {rival !== null && rival.spoke_of_you_count > 0 ? <span className="is-recent">{labels.memoryRivalSpokeOfYou(rival.spoke_of_you_count)}</span> : null}
                {evidence.shared_union !== null ? <span>{labels.memoryRivalSharedUnion(evidence.shared_union)}</span> : null}
                {addressForm !== null ? <span>{labels.memoryRivalCanonBond(addressForm)}</span> : null}
            </div>
            {evidence.self_remarks.length > 0 ? (
                <blockquote className="ever-memory-detail__remark">{evidence.self_remarks[0]}</blockquote>
            ) : null}
            {rival !== null && rival.topics.length > 0 ? (
                <div className="ever-memory-detail__topics">
                    <strong>{labels.memoryRivalTopics}</strong>
                    <div>{rival.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
                </div>
            ) : null}
        </article>
    );
}

