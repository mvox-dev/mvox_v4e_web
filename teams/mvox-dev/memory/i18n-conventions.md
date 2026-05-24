# mvox i18n Conventions

Steward: **Comenius**. All teammates read; only Comenius appends.

Canonical locale list: `en` (source), `et`, `lv`, `uk`. All 4 must stay in sync at all times.

---

## Naming Conventions

Keys are flat strings in `messages/{locale}.json`. No nesting.

### Group prefixes

| Prefix | Use for |
|---|---|
| `common_` | Generic UI concepts reused across features (loading, error, empty states) |
| `actions_` | Verb labels on buttons and interactive controls |
| `participation_` | RSVP, attendance, rehearsal presence |
| `repertoire_` | Works, editions, copies, scores |
| `materials_` | File uploads, attachments, documents |
| `roster_` | Members, sections, roles within an org |
| `events_` | Seasons, events, series, programmes |
| `org_` | Organisation-level settings, onboarding, admin |
| `auth_` | Login, logout, identity, invite flows |

Use `common_` not `shared_`. Use `actions_` not `btn_`. Use `roster_` not `event_members_`.

### Key construction

`<prefix>_<concept>[_<qualifier>]`

- `common_loading`, `common_error`, `common_empty`
- `actions_save`, `actions_cancel`, `actions_add`, `actions_edit`, `actions_delete`
- `events_create_title`, `events_create_submit`
- `roster_member_remove_confirm`

Keep qualifiers short. Avoid restating the prefix in the qualifier (`actions_save_action` → `actions_save`).

### Alphabetical sort

Keys within each JSON file are sorted **alphabetically** by key name. This is the canonical order. Do not group by feature inside the file — the prefix carries all grouping information needed.

---

## 4-Locale Parity Rule

Every key that exists in `messages/en.json` must exist in `messages/et.json`, `messages/lv.json`, and `messages/uk.json` with the same key name. Missing keys in any locale file = build error (Paraglide compiler fails loudly).

At handoff to Bentham: all 4 files must have identical key sets.

---

## Translation Philosophy

Translate **meaning and user intent**, not words. A Paraglide message is a UI affordance, not a dictionary entry. Prefer the natural phrasing a native speaker would use in that UI context.

- **Estonian**: direct and concise; formal register by default (app has institutional users — choir admins, conductors). `Salvesta` not `Salvestage` (imperative 2nd-person singular is standard for UI buttons in Estonian).
- **Latvian**: standard literary Latvian; formal. Infinitive form for button labels where natural (`Saglabāt`, `Atcelt`).
- **Ukrainian**: standard Ukrainian (not surzhyk); formal register. Infinitive for button labels (`Зберегти`, `Скасувати`).

### Music-domain terminology

Choral-music terms that have no idiomatic translation should stay in English (or use the widely-understood loanword). Decision log below — append as new terms arise.

| Term | Policy | Rationale |
|---|---|---|
| choir | et: `koor`, lv: `koris`, uk: `хор` | Standard choral-community term in each language; not the more formal "ensemble" or "kollektiiv" |
| Sign in | et: `Logi sisse`, lv: `Pierakstīties`, uk: `Увійти` | Standard UI login verb per locale; consistent across nav + login page |
| Sign out | et: `Logi välja`, lv: `Izrakstīties`, uk: `Вийти` | Paired with Sign in convention |
| Continue with [brand] | et: `Jätka [brand]uga`, lv: `Turpināt ar [brand]`, uk: `Продовжити з [brand]` | OAuth CTA pattern — infinitive in lv/uk, imperative in et |

### Proper nouns and brand names

Brand names (`Multivox`, `Entu`) are never translated. Entity names entered by users (choir name, event title) are not in message files — they come from the database and are displayed as-is.

---

## Translation Decision Log

Append entries here when a non-obvious translation choice is made. Format: key, locale, chosen value, rationale.

| Key | Locale | Value | Rationale |
|---|---|---|---|
| `common_loading` | et | `Laadimine…` | Noun form (loading as a process); natural in Estonian UI contexts. `Laadin…` (verb) feels too conversational. |
| `common_error` | et | `Tekkis viga` | "An error occurred" — past tense; Estonian UI convention for error states. `Viga` alone is too bare. |
| `common_loading` | lv | `Ielādē…` | Verb form (3rd-person present); natural Latvian pattern for progress states. |
| `common_error` | lv | `Radās kļūda` | "An error arose" — past tense, standard Latvian UI error phrasing. |
| `common_loading` | uk | `Завантаження…` | Noun/verbal noun; standard Ukrainian UI loading indicator text. |
| `common_error` | uk | `Сталася помилка` | "An error occurred" — standard Ukrainian UI error phrasing, feminine agreement with `помилка`. |
| `landing_signed_out_headline` | et | `Laula koos, jaga muusikat` | Imperative 2nd-sg ("Sing together, share music"); direct and energetic, natural Estonian marketing tone. |
| `landing_signed_out_headline` | lv | `Dziediet kopā, dalieties ar mūziku` | Imperative 2nd-pl (formal); Latvian UI prefers formal plural for address. |
| `landing_signed_out_headline` | uk | `Співайте разом, діліться музикою` | Imperative 2nd-pl; standard Ukrainian informal-friendly register. |
| `landing_retry_button` | en | `Try again` | Changed from Byrd stub "Retry" — "Try again" is more conversational, mirrors `landing_error_state` phrasing. |
| `landing_error_state` | en | `Could not load your choirs. Try again.` | Added "Try again." hint to match retry button text and make the error actionable inline. |
| `auth_callback_success` | et | `Sisse logitud. Suunamine…` | "Redirecting" as `Suunamine` (verbal noun); brief for a transient screen. |
| `auth_callback_success` | lv | `Pierakstīšanās veiksmīga. Novirzīšana…` | `Novirzīšana` = redirecting (noun form); standard Latvian UI pattern. |
| `auth_callback_success` | uk | `Вхід виконано. Перенаправлення…` | `Перенаправлення` = redirecting (verbal noun); standard Ukrainian UI pattern. |
| `auth_error_csrf_mismatch` | et | `Sisselogimise turbekontroll ebaõnnestus. Palun alusta uuesti.` | `turbekontroll` = security check; `alusta uuesti` = start again (implies full flow restart, not just retry). |
| `auth_error_csrf_mismatch` | lv | `Pierakstīšanās drošības pārbaude neizdevās. Lūdzu, sāciet no jauna.` | `drošības pārbaude` = security check; `sāciet no jauna` = start again (formal plural). |
| `auth_error_csrf_mismatch` | uk | `Перевірка безпеки входу не вдалася. Будь ласка, почніть знову.` | `Перевірка безпеки` = security check; `почніть знову` = start again (imperative plural). |
| `auth_error_missing_session_token` | et | `Sisselogimine ei lõppenud. Palun proovi uuesti.` | `ei lõppenud` = did not complete; softer/less technical than "no token received". |
| `auth_error_missing_session_token` | lv | `Pierakstīšanās netika pabeigta. Lūdzu, mēģiniet vēlreiz.` | `netika pabeigta` = was not completed (past passive); matches English final-copy tone. |
| `auth_error_missing_session_token` | uk | `Вхід не завершено. Будь ласка, спробуйте ще раз.` | `не завершено` = was not completed (short passive); consistent with English final copy. |
| `landing_members_per_section` | et | `{count} liiget häälerühmas` | `liiget` = members (partitive, works for all numeric values incl. decimals); `häälerühmas` = in the voice group — choral term for section. No pluralization variants: count can be a decimal average. |
| `landing_members_per_section` | lv | `{count} locekļi katrā sekcijā` | `locekļi` = members (nom. pl.); `katrā sekcijā` = in each section. Nominative plural works for display counts. |
| `landing_members_per_section` | uk | `{count} учасників на секцію` | `учасників` = participants/members (gen. pl., standard with numeric count); `на секцію` = per section. |
| `auth_login_heading` | en | `Welcome back` | Updated from "Sign in to mvox" for redesigned login page. Friendlier re-entry tone; eyebrow carries the functional "Sign in" label. |
| `auth_login_heading` | et | `Tere tulemast tagasi` | Literal "Welcome back"; standard warm-return greeting in Estonian UI. |
| `auth_login_heading` | lv | `Laipni atpakaļ` | `Laipni` = graciously/welcome; `atpakaļ` = back. Standard Latvian welcome-back phrase. |
| `auth_login_heading` | uk | `З поверненням` | "With return" — standard Ukrainian welcome-back phrase. |
| `auth_logout_stamp` | et | `Välja logitud` | Past passive; mirrors `auth_callback_success` stamp pattern. |
| `auth_logout_stamp` | lv | `Atteicies` | Reflexive past; "has logged out" — standard Latvian session-end state label. |
| `auth_logout_stamp` | uk | `Вихід виконано` | "Exit performed" — past passive, matches tone of `auth_callback_success`. |
| `auth_provider_email_sub` | et | `maagiline link` | `maagiline` = magical; direct translation of "magic link". |
| `auth_provider_email_sub` | lv | `maģiskā saite` | `maģiskā` = magical (adj.); `saite` = link. Natural Latvian compound. |
| `auth_provider_email_sub` | uk | `магічне посилання` | `магічне` = magical; `посилання` = link. Standard Ukrainian tech phrasing. |
| `library_overdue_marginalia` | et/lv/uk | `TODO` markers | Free-text marginalia with a specific date ("31 May") — deferred for PO to supply locale-specific copy or confirm en passthrough. |

### New key group: `library_*` (added session 21)

Covers: `library_top_*`, `library_rehearsal_*`, `library_search_*`, `library_returns_*`, `library_overdue_*`, `library_pull_*`, `library_catalog_*`.

**Stamp keys** (`library_returns_stamp`, `library_overdue_stamp`, `library_pull_stamp`): uppercase in en; translated uppercase in et/lv/uk where natural ("SAABUNUD", "TAHTAEG ULETATUD", "SHANTTOPTEN" etc.) for visual stamp presentation.

**Parameterized keys in this group:** `library_rehearsal_in` ({time}, {countdown}), `library_returns_counted` ({n}), `library_returns_confirm` ({n}), `library_overdue_borrower_days` ({n}), `library_pull_pull_n` ({n}), `library_pull_request_line` ({date}), `library_catalog_works` ({n}), `library_catalog_owned` ({n}), `library_catalog_available` ({n}), `library_catalog_on_loan` ({n}), `library_catalog_overdue` ({n}).

### New key group: `nav_tab_*` + `nav_chip_*` (added session 22)

Tab label keys for MvoxNav: `nav_tab_agenda`, `nav_tab_library`, `nav_tab_roster`, `nav_tab_notices`, `nav_tab_settings`, `nav_chip_librarian`.

| Key | Locale | Value | Rationale |
|---|---|---|---|
| `nav_tab_agenda` | et | `Kava` | Programme/agenda for choir context; `kava` is the standard Estonian term for a concert or rehearsal programme. |
| `nav_tab_agenda` | lv | `Programma` | Standard Latvian for programme/agenda in a music event context. |
| `nav_tab_agenda` | uk | `Програма` | Standard Ukrainian for programme/agenda. |
| `nav_tab_roster` | et | `Liikmed` | "Members" — direct translation of roster in choir context; `nimekiri` (list) is less natural for a nav tab. |
| `nav_tab_roster` | lv | `Dalībnieki` | "Participants/members" — standard for choir member lists in Latvian. |
| `nav_tab_roster` | uk | `Учасники` | "Participants/members" — standard for choir member lists in Ukrainian. |
| `nav_tab_notices` | et | `Teated` | "Notices/announcements" — concise and natural for a nav tab in Estonian. |
| `nav_tab_notices` | lv | `Paziņojumi` | "Notices/announcements" — standard Latvian UI term. |
| `nav_tab_notices` | uk | `Повідомлення` | "Notices/messages" — standard Ukrainian UI term. |
| `nav_tab_settings` | et | `Seaded` | "Settings" — standard Estonian UI term. |
| `nav_tab_settings` | lv | `Iestatījumi` | "Settings" — standard Latvian UI term. |
| `nav_tab_settings` | uk | `Налаштування` | "Settings" — standard Ukrainian UI term. |
| `nav_chip_librarian` | et | `RAAMATUKOGUHOIDJA` | Uppercase per visual chip presentation. Long but correct Estonian term. |
| `nav_chip_librarian` | lv | `BIBLIOTEKĀRS` | Uppercase; `bibliotekārs` = librarian in Latvian. |
| `nav_chip_librarian` | uk | `БІБЛІОТЕКАР` | Uppercase; standard Ukrainian term. |
| `nav_org_picker_placeholder` | et | `Organisatsioone pole` | "No organizations" — genitive plural (pole + gen.pl.); natural Estonian negative-existence phrasing. |
| `nav_org_picker_placeholder` | lv | `Nav organizāciju` | "No organizations" — `nav` (there isn't/aren't) + gen.pl.; standard Latvian negative-existence form. |
| `nav_org_picker_placeholder` | uk | `Немає організацій` | "No organizations" — `немає` + gen.pl.; standard Ukrainian negative-existence phrasing. |
| `nav_org_picker_switch_to` | et | `Lülitu: {orgName}` | "Switch: {orgName}" — imperative singular; colon separates verb from target; aria-label context. Shorter than "Lülitu organisatsioonile" without losing clarity. |
| `nav_org_picker_switch_to` | lv | `Pārslēgt uz {orgName}` | "Switch to {orgName}" — infinitive + `uz` (to/onto); standard Latvian action phrasing for aria-labels. |
| `nav_org_picker_switch_to` | uk | `Перейти до {orgName}` | "Go to {orgName}" — infinitive + `до` (to/into); natural Ukrainian aria-label for navigation-style selection. |

(*MVOX:Comenius*)
