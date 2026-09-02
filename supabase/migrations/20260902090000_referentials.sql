-- Referentiels geographiques et scolaires
-- Remplace les constantes TypeScript GRADE_LEVELS / COURSE_SUBJECTS / LangKey
-- par des tables interrogeables. Idempotent : rejouable sans effet de bord.

begin;

create extension if not exists "pgcrypto";

-- Precondition : public.is_admin() vient de admin_console_portal_migration.sql.
-- Sans elle, les politiques d'ecriture ci-dessous seraient creees a vide.
do $pre$
begin
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception 'Appliquez d''abord supabase/admin_console_portal_migration.sql (fonction public.is_admin manquante).';
  end if;
end $pre$;

/* -------------------------------------------------------------------------- */
/* Pays (ISO 3166-1 alpha-2)                                                  */
/* -------------------------------------------------------------------------- */
create table if not exists public.countries (
  code text primary key,
  name_fr text not null,
  flag text not null,
  has_content boolean not null default false,
  created_at timestamptz not null default now(),
  constraint countries_code_shape_chk check (code ~ '^[A-Z][A-Z]$')
);

create index if not exists countries_has_content_idx on public.countries (has_content) where has_content = true;
create index if not exists countries_name_fr_idx on public.countries (name_fr);

insert into public.countries (code, name_fr, flag, has_content) values
  ('AD', 'Andorre', '🇦🇩', false),
  ('AE', 'Émirats arabes unis', '🇦🇪', false),
  ('AF', 'Afghanistan', '🇦🇫', false),
  ('AG', 'Antigua-et-Barbuda', '🇦🇬', false),
  ('AI', 'Anguilla', '🇦🇮', false),
  ('AL', 'Albanie', '🇦🇱', false),
  ('AM', 'Arménie', '🇦🇲', false),
  ('AO', 'Angola', '🇦🇴', false),
  ('AQ', 'Antarctique', '🇦🇶', false),
  ('AR', 'Argentine', '🇦🇷', false),
  ('AS', 'Samoa américaines', '🇦🇸', false),
  ('AT', 'Autriche', '🇦🇹', false),
  ('AU', 'Australie', '🇦🇺', false),
  ('AW', 'Aruba', '🇦🇼', false),
  ('AX', 'Îles Åland', '🇦🇽', false),
  ('AZ', 'Azerbaïdjan', '🇦🇿', false),
  ('BA', 'Bosnie-Herzégovine', '🇧🇦', false),
  ('BB', 'Barbade', '🇧🇧', false),
  ('BD', 'Bangladesh', '🇧🇩', false),
  ('BE', 'Belgique', '🇧🇪', false),
  ('BF', 'Burkina Faso', '🇧🇫', false),
  ('BG', 'Bulgarie', '🇧🇬', false),
  ('BH', 'Bahreïn', '🇧🇭', false),
  ('BI', 'Burundi', '🇧🇮', false),
  ('BJ', 'Bénin', '🇧🇯', true),
  ('BL', 'Saint-Barthélemy', '🇧🇱', false),
  ('BM', 'Bermudes', '🇧🇲', false),
  ('BN', 'Brunei', '🇧🇳', false),
  ('BO', 'Bolivie', '🇧🇴', false),
  ('BQ', 'Pays-Bas caribéens', '🇧🇶', false),
  ('BR', 'Brésil', '🇧🇷', false),
  ('BS', 'Bahamas', '🇧🇸', false),
  ('BT', 'Bhoutan', '🇧🇹', false),
  ('BV', 'Île Bouvet', '🇧🇻', false),
  ('BW', 'Botswana', '🇧🇼', false),
  ('BY', 'Biélorussie', '🇧🇾', false),
  ('BZ', 'Belize', '🇧🇿', false),
  ('CA', 'Canada', '🇨🇦', false),
  ('CC', 'Îles Cocos', '🇨🇨', false),
  ('CD', 'République démocratique du Congo', '🇨🇩', false),
  ('CF', 'République centrafricaine', '🇨🇫', false),
  ('CG', 'République du Congo', '🇨🇬', false),
  ('CH', 'Suisse', '🇨🇭', false),
  ('CI', 'Côte d''Ivoire', '🇨🇮', false),
  ('CK', 'Îles Cook', '🇨🇰', false),
  ('CL', 'Chili', '🇨🇱', false),
  ('CM', 'Cameroun', '🇨🇲', false),
  ('CN', 'Chine', '🇨🇳', false),
  ('CO', 'Colombie', '🇨🇴', false),
  ('CR', 'Costa Rica', '🇨🇷', false),
  ('CU', 'Cuba', '🇨🇺', false),
  ('CV', 'Cap-Vert', '🇨🇻', false),
  ('CW', 'Curaçao', '🇨🇼', false),
  ('CX', 'Île Christmas', '🇨🇽', false),
  ('CY', 'Chypre', '🇨🇾', false),
  ('CZ', 'Tchéquie', '🇨🇿', false),
  ('DE', 'Allemagne', '🇩🇪', false),
  ('DJ', 'Djibouti', '🇩🇯', false),
  ('DK', 'Danemark', '🇩🇰', false),
  ('DM', 'Dominique', '🇩🇲', false),
  ('DO', 'République dominicaine', '🇩🇴', false),
  ('DZ', 'Algérie', '🇩🇿', false),
  ('EC', 'Équateur', '🇪🇨', false),
  ('EE', 'Estonie', '🇪🇪', false),
  ('EG', 'Égypte', '🇪🇬', false),
  ('EH', 'Sahara occidental', '🇪🇭', false),
  ('ER', 'Érythrée', '🇪🇷', false),
  ('ES', 'Espagne', '🇪🇸', false),
  ('ET', 'Éthiopie', '🇪🇹', false),
  ('FI', 'Finlande', '🇫🇮', false),
  ('FJ', 'Fidji', '🇫🇯', false),
  ('FK', 'Îles Malouines', '🇫🇰', false),
  ('FM', 'Micronésie', '🇫🇲', false),
  ('FO', 'Îles Féroé', '🇫🇴', false),
  ('FR', 'France', '🇫🇷', false),
  ('GA', 'Gabon', '🇬🇦', false),
  ('GB', 'Royaume-Uni', '🇬🇧', false),
  ('GD', 'Grenade', '🇬🇩', false),
  ('GE', 'Géorgie', '🇬🇪', false),
  ('GF', 'Guyane française', '🇬🇫', false),
  ('GG', 'Guernesey', '🇬🇬', false),
  ('GH', 'Ghana', '🇬🇭', false),
  ('GI', 'Gibraltar', '🇬🇮', false),
  ('GL', 'Groenland', '🇬🇱', false),
  ('GM', 'Gambie', '🇬🇲', false),
  ('GN', 'Guinée', '🇬🇳', false),
  ('GP', 'Guadeloupe', '🇬🇵', false),
  ('GQ', 'Guinée équatoriale', '🇬🇶', false),
  ('GR', 'Grèce', '🇬🇷', false),
  ('GS', 'Géorgie du Sud-et-les Îles Sandwich du Sud', '🇬🇸', false),
  ('GT', 'Guatemala', '🇬🇹', false),
  ('GU', 'Guam', '🇬🇺', false),
  ('GW', 'Guinée-Bissau', '🇬🇼', false),
  ('GY', 'Guyana', '🇬🇾', false),
  ('HK', 'Hong Kong', '🇭🇰', false),
  ('HM', 'Îles Heard-et-MacDonald', '🇭🇲', false),
  ('HN', 'Honduras', '🇭🇳', false),
  ('HR', 'Croatie', '🇭🇷', false),
  ('HT', 'Haïti', '🇭🇹', false),
  ('HU', 'Hongrie', '🇭🇺', false),
  ('ID', 'Indonésie', '🇮🇩', false),
  ('IE', 'Irlande', '🇮🇪', false),
  ('IL', 'Israël', '🇮🇱', false),
  ('IM', 'Île de Man', '🇮🇲', false),
  ('IN', 'Inde', '🇮🇳', false),
  ('IO', 'Territoire britannique de l''océan Indien', '🇮🇴', false),
  ('IQ', 'Irak', '🇮🇶', false),
  ('IR', 'Iran', '🇮🇷', false),
  ('IS', 'Islande', '🇮🇸', false),
  ('IT', 'Italie', '🇮🇹', false),
  ('JE', 'Jersey', '🇯🇪', false),
  ('JM', 'Jamaïque', '🇯🇲', false),
  ('JO', 'Jordanie', '🇯🇴', false),
  ('JP', 'Japon', '🇯🇵', false),
  ('KE', 'Kenya', '🇰🇪', false),
  ('KG', 'Kirghizistan', '🇰🇬', false),
  ('KH', 'Cambodge', '🇰🇭', false),
  ('KI', 'Kiribati', '🇰🇮', false),
  ('KM', 'Comores', '🇰🇲', false),
  ('KN', 'Saint-Christophe-et-Niévès', '🇰🇳', false),
  ('KP', 'Corée du Nord', '🇰🇵', false),
  ('KR', 'Corée du Sud', '🇰🇷', false),
  ('KW', 'Koweït', '🇰🇼', false),
  ('KY', 'Îles Caïmans', '🇰🇾', false),
  ('KZ', 'Kazakhstan', '🇰🇿', false),
  ('LA', 'Laos', '🇱🇦', false),
  ('LB', 'Liban', '🇱🇧', false),
  ('LC', 'Sainte-Lucie', '🇱🇨', false),
  ('LI', 'Liechtenstein', '🇱🇮', false),
  ('LK', 'Sri Lanka', '🇱🇰', false),
  ('LR', 'Liberia', '🇱🇷', false),
  ('LS', 'Lesotho', '🇱🇸', false),
  ('LT', 'Lituanie', '🇱🇹', false),
  ('LU', 'Luxembourg', '🇱🇺', false),
  ('LV', 'Lettonie', '🇱🇻', false),
  ('LY', 'Libye', '🇱🇾', false),
  ('MA', 'Maroc', '🇲🇦', false),
  ('MC', 'Monaco', '🇲🇨', false),
  ('MD', 'Moldavie', '🇲🇩', false),
  ('ME', 'Monténégro', '🇲🇪', false),
  ('MF', 'Saint-Martin', '🇲🇫', false),
  ('MG', 'Madagascar', '🇲🇬', false),
  ('MH', 'Îles Marshall', '🇲🇭', false),
  ('MK', 'Macédoine du Nord', '🇲🇰', false),
  ('ML', 'Mali', '🇲🇱', false),
  ('MM', 'Birmanie', '🇲🇲', false),
  ('MN', 'Mongolie', '🇲🇳', false),
  ('MO', 'Macao', '🇲🇴', false),
  ('MP', 'Îles Mariannes du Nord', '🇲🇵', false),
  ('MQ', 'Martinique', '🇲🇶', false),
  ('MR', 'Mauritanie', '🇲🇷', false),
  ('MS', 'Montserrat', '🇲🇸', false),
  ('MT', 'Malte', '🇲🇹', false),
  ('MU', 'Maurice', '🇲🇺', false),
  ('MV', 'Maldives', '🇲🇻', false),
  ('MW', 'Malawi', '🇲🇼', false),
  ('MX', 'Mexique', '🇲🇽', false),
  ('MY', 'Malaisie', '🇲🇾', false),
  ('MZ', 'Mozambique', '🇲🇿', false),
  ('NA', 'Namibie', '🇳🇦', false),
  ('NC', 'Nouvelle-Calédonie', '🇳🇨', false),
  ('NE', 'Niger', '🇳🇪', false),
  ('NF', 'Île Norfolk', '🇳🇫', false),
  ('NG', 'Nigeria', '🇳🇬', false),
  ('NI', 'Nicaragua', '🇳🇮', false),
  ('NL', 'Pays-Bas', '🇳🇱', false),
  ('NO', 'Norvège', '🇳🇴', false),
  ('NP', 'Népal', '🇳🇵', false),
  ('NR', 'Nauru', '🇳🇷', false),
  ('NU', 'Niue', '🇳🇺', false),
  ('NZ', 'Nouvelle-Zélande', '🇳🇿', false),
  ('OM', 'Oman', '🇴🇲', false),
  ('PA', 'Panama', '🇵🇦', false),
  ('PE', 'Pérou', '🇵🇪', false),
  ('PF', 'Polynésie française', '🇵🇫', false),
  ('PG', 'Papouasie-Nouvelle-Guinée', '🇵🇬', false),
  ('PH', 'Philippines', '🇵🇭', false),
  ('PK', 'Pakistan', '🇵🇰', false),
  ('PL', 'Pologne', '🇵🇱', false),
  ('PM', 'Saint-Pierre-et-Miquelon', '🇵🇲', false),
  ('PN', 'Îles Pitcairn', '🇵🇳', false),
  ('PR', 'Porto Rico', '🇵🇷', false),
  ('PS', 'Palestine', '🇵🇸', false),
  ('PT', 'Portugal', '🇵🇹', false),
  ('PW', 'Palaos', '🇵🇼', false),
  ('PY', 'Paraguay', '🇵🇾', false),
  ('QA', 'Qatar', '🇶🇦', false),
  ('RE', 'La Réunion', '🇷🇪', false),
  ('RO', 'Roumanie', '🇷🇴', false),
  ('RS', 'Serbie', '🇷🇸', false),
  ('RU', 'Russie', '🇷🇺', false),
  ('RW', 'Rwanda', '🇷🇼', false),
  ('SA', 'Arabie saoudite', '🇸🇦', false),
  ('SB', 'Îles Salomon', '🇸🇧', false),
  ('SC', 'Seychelles', '🇸🇨', false),
  ('SD', 'Soudan', '🇸🇩', false),
  ('SE', 'Suède', '🇸🇪', false),
  ('SG', 'Singapour', '🇸🇬', false),
  ('SH', 'Sainte-Hélène', '🇸🇭', false),
  ('SI', 'Slovénie', '🇸🇮', false),
  ('SJ', 'Svalbard et Jan Mayen', '🇸🇯', false),
  ('SK', 'Slovaquie', '🇸🇰', false),
  ('SL', 'Sierra Leone', '🇸🇱', false),
  ('SM', 'Saint-Marin', '🇸🇲', false),
  ('SN', 'Sénégal', '🇸🇳', false),
  ('SO', 'Somalie', '🇸🇴', false),
  ('SR', 'Suriname', '🇸🇷', false),
  ('SS', 'Soudan du Sud', '🇸🇸', false),
  ('ST', 'Sao Tomé-et-Principe', '🇸🇹', false),
  ('SV', 'Salvador', '🇸🇻', false),
  ('SX', 'Saint-Martin (partie néerlandaise)', '🇸🇽', false),
  ('SY', 'Syrie', '🇸🇾', false),
  ('SZ', 'Eswatini', '🇸🇿', false),
  ('TC', 'Îles Turques-et-Caïques', '🇹🇨', false),
  ('TD', 'Tchad', '🇹🇩', false),
  ('TF', 'Terres australes françaises', '🇹🇫', false),
  ('TG', 'Togo', '🇹🇬', false),
  ('TH', 'Thaïlande', '🇹🇭', false),
  ('TJ', 'Tadjikistan', '🇹🇯', false),
  ('TK', 'Tokelau', '🇹🇰', false),
  ('TL', 'Timor oriental', '🇹🇱', false),
  ('TM', 'Turkménistan', '🇹🇲', false),
  ('TN', 'Tunisie', '🇹🇳', false),
  ('TO', 'Tonga', '🇹🇴', false),
  ('TR', 'Turquie', '🇹🇷', false),
  ('TT', 'Trinité-et-Tobago', '🇹🇹', false),
  ('TV', 'Tuvalu', '🇹🇻', false),
  ('TW', 'Taïwan', '🇹🇼', false),
  ('TZ', 'Tanzanie', '🇹🇿', false),
  ('UA', 'Ukraine', '🇺🇦', false),
  ('UG', 'Ouganda', '🇺🇬', false),
  ('UM', 'Îles mineures éloignées des États-Unis', '🇺🇲', false),
  ('US', 'États-Unis', '🇺🇸', false),
  ('UY', 'Uruguay', '🇺🇾', false),
  ('UZ', 'Ouzbékistan', '🇺🇿', false),
  ('VA', 'Vatican', '🇻🇦', false),
  ('VC', 'Saint-Vincent-et-les-Grenadines', '🇻🇨', false),
  ('VE', 'Venezuela', '🇻🇪', false),
  ('VG', 'Îles Vierges britanniques', '🇻🇬', false),
  ('VI', 'Îles Vierges des États-Unis', '🇻🇮', false),
  ('VN', 'Viêt Nam', '🇻🇳', false),
  ('VU', 'Vanuatu', '🇻🇺', false),
  ('WF', 'Wallis-et-Futuna', '🇼🇫', false),
  ('WS', 'Samoa', '🇼🇸', false),
  ('YE', 'Yémen', '🇾🇪', false),
  ('YT', 'Mayotte', '🇾🇹', false),
  ('ZA', 'Afrique du Sud', '🇿🇦', false),
  ('ZM', 'Zambie', '🇿🇲', false),
  ('ZW', 'Zimbabwe', '🇿🇼', false)
on conflict (code) do update
set name_fr = excluded.name_fr,
    flag = excluded.flag;

/* -------------------------------------------------------------------------- */
/* Systemes educatifs                                                         */
/* -------------------------------------------------------------------------- */
create table if not exists public.education_systems (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete cascade,
  code text not null,
  label text not null,
  is_default boolean not null default true,
  unique (country_code, code)
);

create index if not exists education_systems_country_idx on public.education_systems (country_code);

insert into public.education_systems (country_code, code, label, is_default)
values ('BJ', 'general', 'Enseignement general', true)
on conflict (country_code, code) do update set label = excluded.label;

update public.education_systems
set label = 'Enseignement g' || chr(233) || 'n' || chr(233) || 'ral'
where country_code = 'BJ' and code = 'general';

/* -------------------------------------------------------------------------- */
/* Niveaux scolaires                                                          */
/* -------------------------------------------------------------------------- */
create table if not exists public.grade_levels (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.education_systems(id) on delete cascade,
  code text not null,
  label text not null,
  cycle text not null,
  order_index integer not null,
  unique (system_id, code),
  constraint grade_levels_cycle_chk check (cycle in ('primaire', 'college', 'lycee'))
);

create index if not exists grade_levels_system_order_idx on public.grade_levels (system_id, order_index);

insert into public.grade_levels (system_id, code, label, cycle, order_index)
select s.id, v.code, v.label, v.cycle, v.order_index
from public.education_systems s
cross join (values
  ('6e',        '6e',        'college', 1),
  ('5e',        '5e',        'college', 2),
  ('4e',        '4e',        'college', 3),
  ('3e',        '3e',        'college', 4),
  ('2nde',      '2nde',      'lycee',   5),
  ('1ere',      '1ere',      'lycee',   6),
  ('Terminale', 'Terminale', 'lycee',   7)
) as v(code, label, cycle, order_index)
where s.country_code = 'BJ' and s.code = 'general'
on conflict (system_id, code) do update
set label = excluded.label,
    cycle = excluded.cycle,
    order_index = excluded.order_index;

update public.grade_levels
set label = '1' || chr(232) || 're'
where code = '1ere';

/* -------------------------------------------------------------------------- */
/* Matieres                                                                   */
/* -------------------------------------------------------------------------- */
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.education_systems(id) on delete cascade,
  code text not null,
  label text not null,
  order_index integer not null,
  unique (system_id, code)
);

create index if not exists subjects_system_order_idx on public.subjects (system_id, order_index);

insert into public.subjects (system_id, code, label, order_index)
select s.id, v.code, v.label, v.order_index
from public.education_systems s
cross join (values
  ('maths',        'Maths',                  1),
  ('pct',          'Physique-Chimie (PCT)',  2),
  ('svt',          'SVT',                    3),
  ('francais',     'Francais',               4),
  ('anglais',      'Anglais',                5),
  ('espagnol',     'Espagnol',               6),
  ('hg',           'Histoire-Geographie',    7),
  ('philosophie',  'Philosophie',            8),
  ('informatique', 'Informatique',           9)
) as v(code, label, order_index)
where s.country_code = 'BJ' and s.code = 'general'
on conflict (system_id, code) do update
set label = excluded.label,
    order_index = excluded.order_index;

-- Les libelles accentues sont poses via chr() pour rester lisibles quel que
-- soit l'encodage du client psql qui applique la migration.
update public.subjects set label = 'Fran' || chr(231) || 'ais' where code = 'francais';
update public.subjects set label = 'Histoire-G' || chr(233) || 'ographie' where code = 'hg';

/* -------------------------------------------------------------------------- */
/* Langues d'enseignement                                                     */
/* -------------------------------------------------------------------------- */
create table if not exists public.languages (
  code text primary key,
  label text not null,
  is_local boolean not null default false,
  order_index integer not null default 0
);

insert into public.languages (code, label, is_local, order_index) values
  ('fr',     'Francais', false, 0),
  ('fon',    'Fon',      true,  1),
  ('adja',   'Adja',     true,  2),
  ('yoruba', 'Yoruba',   true,  3),
  ('dendi',  'Dendi',    true,  4)
on conflict (code) do update
set label = excluded.label,
    is_local = excluded.is_local,
    order_index = excluded.order_index;

update public.languages set label = 'Fran' || chr(231) || 'ais' where code = 'fr';

create table if not exists public.country_languages (
  country_code text not null references public.countries(code) on delete cascade,
  language_code text not null references public.languages(code) on delete cascade,
  primary key (country_code, language_code)
);

insert into public.country_languages (country_code, language_code) values
  ('BJ', 'fr'), ('BJ', 'fon'), ('BJ', 'adja'), ('BJ', 'yoruba'), ('BJ', 'dendi')
on conflict do nothing;

/* -------------------------------------------------------------------------- */
/* Correction de la cle de langue : dindi -> dendi                            */
/* -------------------------------------------------------------------------- */
update public.chapters
set video_by_lang = (video_by_lang - 'dindi') || jsonb_build_object('dendi', video_by_lang -> 'dindi')
where video_by_lang ? 'dindi';

/* -------------------------------------------------------------------------- */
/* Profils : pays + niveau scolaire                                           */
/* -------------------------------------------------------------------------- */
alter table public.profiles
  add column if not exists country_code text references public.countries(code),
  add column if not exists grade_level_id uuid references public.grade_levels(id);

create index if not exists profiles_country_code_idx on public.profiles (country_code);
create index if not exists profiles_grade_level_id_idx on public.profiles (grade_level_id);

-- Rattache les comptes existants au Benin : c'est le seul pays ouvert a ce jour.
update public.profiles
set country_code = 'BJ'
where country_code is null;

-- Reprend le texte libre 'grade' vers le referentiel, alias inclus.
update public.profiles p
set grade_level_id = gl.id
from public.grade_levels gl
join public.education_systems es on es.id = gl.system_id
where p.grade_level_id is null
  and es.country_code = 'BJ'
  and es.code = 'general'
  and gl.code = case lower(regexp_replace(coalesce(p.grade, ''), '[^a-zA-Z0-9]', '', 'g'))
    when '6e'        then '6e'
    when '6eme'      then '6e'
    when '5e'        then '5e'
    when '5eme'      then '5e'
    when '4e'        then '4e'
    when '4eme'      then '4e'
    when '3e'        then '3e'
    when '3eme'      then '3e'
    when '2nde'      then '2nde'
    when '2de'       then '2nde'
    when '2nd'       then '2nde'
    when 'seconde'   then '2nde'
    when '1ere'      then '1ere'
    when '1re'       then '1ere'
    when 'premiere'  then '1ere'
    when 'tle'       then 'Terminale'
    when 'terminale' then 'Terminale'
    else null
  end;

-- Garde la colonne texte 'grade' alignee sur le referentiel : l'application
-- deja publiee lit encore 'grade', et les contenus portent encore un niveau texte.
create or replace function public.sync_profile_grade_text()
returns trigger
language plpgsql
as $fn$
begin
  if new.grade_level_id is not null then
    select gl.code into new.grade
    from public.grade_levels gl
    where gl.id = new.grade_level_id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_sync_grade_text on public.profiles;
create trigger profiles_sync_grade_text
before insert or update of grade_level_id on public.profiles
for each row execute function public.sync_profile_grade_text();

/* -------------------------------------------------------------------------- */
/* Lecture publique des referentiels                                          */
/* -------------------------------------------------------------------------- */
-- Le formulaire d'inscription a besoin de la liste des pays et des classes
-- avant toute authentification : la lecture est donc ouverte a anon.
alter table public.countries enable row level security;
alter table public.education_systems enable row level security;
alter table public.grade_levels enable row level security;
alter table public.subjects enable row level security;
alter table public.languages enable row level security;
alter table public.country_languages enable row level security;

drop policy if exists countries_select on public.countries;
create policy countries_select on public.countries for select using (true);

drop policy if exists education_systems_select on public.education_systems;
create policy education_systems_select on public.education_systems for select using (true);

drop policy if exists grade_levels_select on public.grade_levels;
create policy grade_levels_select on public.grade_levels for select using (true);

drop policy if exists subjects_select on public.subjects;
create policy subjects_select on public.subjects for select using (true);

drop policy if exists languages_select on public.languages;
create policy languages_select on public.languages for select using (true);

drop policy if exists country_languages_select on public.country_languages;
create policy country_languages_select on public.country_languages for select using (true);

-- Ecriture reservee aux administrateurs.
do $pol$
declare
  t text;
begin
  foreach t in array array['countries', 'education_systems', 'grade_levels', 'subjects', 'languages', 'country_languages']
  loop
    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format(
      'create policy %I_admin_write on public.%I for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))',
      t, t
    );
  end loop;
end $pol$;

grant select on
  public.countries,
  public.education_systems,
  public.grade_levels,
  public.subjects,
  public.languages,
  public.country_languages
to anon, authenticated;

commit;
