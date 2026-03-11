# SocialSync-AI API Endpoints Reference

Base URL: `/api/v1/`
Auth: `Authorization: Bearer <JWT_TOKEN>`

## Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | auth/register/ | Register new user |
| POST | auth/register-with-brand/ | Register + create brand |
| POST | auth/login/ | Login → returns JWT pair |
| POST | auth/logout/ | Logout (blacklist token) |
| POST | auth/refresh/ | Refresh JWT token |
| GET | auth/me/ | Current user info |

## User Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | profile/ | User profile CRUD |
| GET/PUT | profile/api-keys/ | Manage global API keys |

## Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | dashboard/stats/ | Dashboard stats |
| GET | dashboard/recent/ | Recent posts |

## Onboarding
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | onboarding/ | Onboarding progress |
| POST | onboarding/step/<int>/ | Mark step complete |
| POST | onboarding/skip/ | Skip onboarding |

## Posts & Drafts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | posts/ | Post list/create (ViewSet) |
| GET/PUT/DELETE | posts/<id>/ | Post detail |
| POST | drafts/<id>/captions/ | Create manual caption |
| POST | drafts/<id>/captions/generate/ | AI-generate captions |
| POST | drafts/<id>/hashtags/ | Create hashtags |
| POST | drafts/<id>/hashtags/generate/ | AI-generate hashtags |
| POST | drafts/<id>/checklist/ | Update checklist |
| POST | drafts/<id>/assets/ | Add asset to draft |
| POST | drafts/<id>/submit/ | Submit for approval |
| POST | drafts/<id>/approve/ | Approve draft |
| POST | drafts/<id>/request-changes/ | Request changes |
| POST | drafts/<id>/reject/ | Reject draft |
| POST | drafts/<id>/schedule/ | Schedule post |
| GET | approvals/pending/ | Pending approval queue |
| GET | schedule/calendar/ | Calendar view |

## AI Caption
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | ai-caption/generate/ | Generate captions (8 tones × 4 lengths × 8 platforms) |
| POST | ai-caption/regenerate/<id>/ | Regenerate single caption |
| GET | ai-caption/history/ | Generation history |
| GET/PUT | ai-caption/settings/ | Caption AI settings |

## AI Image
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | ai-image/generate/ | Generate images (DALL-E 3 / Gemini) |
| POST | ai-image/refine-prompt/ | Refine image prompt |
| GET | ai-image/history/ | Image history |
| GET/PUT | ai-image/settings/ | Image AI settings |
| POST | assets/<id>/copy-overlay/ | Apply text copy overlay (V1.2.2) |
| POST | copy-overlay/generate-text/ | AI-generate overlay text (V1.2.2) |

## AI Video
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | ai-video/generate/ | Generate videos |
| GET | ai-video/history/ | Video history |
| GET/PUT | ai-video/settings/ | Video AI settings |

## AI Voice
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | ai-voice/generate/ | Generate voice audio |
| POST | ai-voice/preview/ | Voice preview |
| GET | ai-voice/history/ | Voice history |
| GET/PUT | ai-voice/settings/ | Voice AI settings |

## Brands & Workspaces
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | workspaces/ | Workspace list/create |
| GET/PUT/DELETE | workspaces/<id>/ | Workspace detail |
| GET/POST | brands/ | Brand list/create |
| GET/PUT/DELETE | brands/<id>/ | Brand detail |
| POST | brands/<id>/generate-dna/ | Generate brand DNA |
| GET | brands/<id>/dna-status/ | Brand DNA generation status |
| GET | brands/<id>/trending/ | Trending topics for brand |
| POST | brands/<id>/pillars/generate/ | AI-generate content pillars |
| GET | brands/<id>/competitors/insights/ | Competitor insights |
| GET/POST | brands/<id>/ideas/ | Content ideas |
| POST | brands/<id>/ideas/generate/ | AI-generate content ideas |

## Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | analytics/summary/ | Analytics summary |
| GET | analytics/platforms/ | Per-platform analytics |
| GET | analytics/trends/ | Trend analysis |
| POST | posts/<id>/repurpose/ | Repurpose post to new format |

## RBAC
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | workspaces/<id>/roles/ | List roles |
| POST | workspaces/<id>/roles/assign/ | Assign role to user |
| POST | workspaces/<id>/roles/remove/ | Remove role |
| GET | my-roles/ | Current user's roles |

## Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | notifications/ | Notification list |
| GET | notifications/unread-count/ | Unread count |
| POST | notifications/<id>/read/ | Mark as read |
| POST | notifications/mark-all-read/ | Mark all read |

## Messenger Bot
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | messenger/dashboard/ | Bot dashboard |
| GET/POST | messenger/connections/ | Connection list/create |
| GET/PUT | messenger/connections/<id>/ | Connection detail |
| PUT | messenger/connections/<id>/config/ | Bot configuration |
| GET/POST | messenger/connections/<id>/pdfs/ | PDF knowledge base |
| DELETE | messenger/connections/<id>/pdfs/<pid>/ | Delete PDF |
| GET | messenger/connections/<id>/conversations/ | Conversations list |
| GET | messenger/connections/<id>/conversations/<cid>/messages/ | Message history |
| POST | messenger/connections/<id>/conversations/<cid>/takeover/ | Human takeover toggle |
| GET | messenger/connections/<id>/ecommerce/ | E-commerce settings |
| POST | messenger/connections/<id>/ecommerce/sync/ | Sync products |
| POST/GET | webhook/messenger/<verify_token>/ | Facebook webhook (GET=verify, POST=events) |

## Platforms (Social Accounts)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | platforms/ | Connected platforms |
| POST | platforms/<platform>/connect/ | Connect platform |
| DELETE | platforms/<id>/disconnect/ | Disconnect platform |
| GET | platforms/<id>/validate/ | Validate token |

## Admin Panel
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | admin/dashboard/ | Admin stats |
| GET | admin/users/ | User list |
| GET | admin/users/<id>/ | User detail |
| POST | admin/users/<id>/approve/ | Approve user account |
| POST | admin/users/<id>/plan/ | Update subscription plan |
| GET | admin/users/<id>/posts/ | User's posts |
| GET | admin/users/<id>/captions/ | User's captions |
| GET | admin/users/<id>/impersonate/ | Impersonate user |

## Key Implementation Notes
- All endpoints require JWT Bearer token (except auth/register, auth/login, webhook)
- Impersonation via `X-Impersonate-User: <user_id>` header (admin only)
- Pagination: `?page=N&page_size=10` (default page_size=10)
- API docs: `/doc/api/` (Swagger) and `/doc/api/redoc/`
