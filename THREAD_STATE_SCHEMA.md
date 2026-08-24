# THREAD STATE SCHEMA

저장소: `state/threads.sqlite3` (`node:sqlite`)

## threads
| 컬럼 | 설명 |
|---|---|
| conversation_key (PK) | `agent_id \| channel \| bot_account_id \| chat_id \| topic_id` |
| agent_id / channel / bot_account_id / chat_id / topic_id | 키 구성 요소 |
| thread_id | 엔진 측 대화 ID (codex thread / claude session) |
| engine | 그 thread를 만든 엔진 id |
| created_at / updated_at | ISO8601 |

## seen_updates
| 컬럼 | 설명 |
|---|---|
| update_id (PK) | 텔레그램 멱등성 키. 재시작 후에도 중복 처리 방지 |
| seen_at | ISO8601 |

## offsets
| 컬럼 | 설명 |
|---|---|
| k (PK) | `telegram` |
| v | 다음 getUpdates offset |

## onboarding (ENG-041)
| 컬럼 | 설명 |
|---|---|
| conversation_key (PK) | threads 와 동일한 키 |
| wizard_type | menu / site / engine / github / telegram / migrate |
| step | 현재 단계 이름 |
| answers | 지금까지의 답 (JSON). **비밀값은 들어가지 않는다** |
| updated_at | ISO8601. 15분 무응답이면 만료 |

## connect_locks (ENG-044)
| 컬럼 | 설명 |
|---|---|
| site_id (PK) | 사이트당 1개 |
| conversation_key | 락 보유 대화 |
| expires_at | 만료 시각(15분). 지나면 자동 회수 |

## 규칙
- 엔진을 전환해도 conversation_key는 그대로다. thread_id만 새로 발급된다.
- 응답은 `chat_id` (+`topic_id`) 로만 보낸다.
- 이 파일은 gitignore 대상이다.
