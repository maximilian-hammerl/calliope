-- migrate:up

CREATE TYPE public.writing_group_visibility AS ENUM ('public', 'private');

-- Shared by writing_group and story_idea, so an idea's language survives becoming a group.
-- An enum, not text: a filter over free text is no filter. Two values until somebody needs a
-- third; members select rather than type, so nothing can be misspelt.
CREATE TYPE public.story_language AS ENUM ('german', 'english');

-- §7.4 also lists 'archived', left out until there is something to distinguish it from
-- 'finished': §22's archive is a *group* lifecycle — hidden, read-only, restorable — and none
-- of that is built, so the value would carry no behaviour.
CREATE TYPE public.writing_group_story_status AS ENUM ('planning', 'writing', 'finished');

-- The story metadata vocabularies, shared by writing_group and story_idea like story_language
-- above, and enums for the same stated reason: a filter over free text is no filter.
--
-- EVERY VALUE BELOW IS A CANDIDATE, NOT A DECISION. `favourite-books` marks a value taken from
-- that repository's own lists, `proposed` one of mine, `both` a value in each. Cut before this
-- ships: Postgres can add an enum value but never remove one.
--
-- Hybrid genres live in this list rather than in a third type of their own, which is what
-- favourite-books settled on after a separate list proved unproductive.
CREATE TYPE public.story_genre AS ENUM (
    'action',          -- favourite-books
    'adventure',       -- both
    'comedy',          -- both
    'crime',           -- favourite-books
    'mystery',         -- both
    'fantasy',         -- both
    'horror',          -- both
    'science_fiction', -- both
    'science_fantasy', -- favourite-books — a hybrid genre, which this list carries too
    'romance',         -- both
    'romantasy',       -- proposed hybrid; a subgenre in favourite-books
    'thriller',        -- proposed; a subgenre in favourite-books
    'historical',      -- proposed; a subgenre in favourite-books
    'gothic',          -- proposed; a subgenre in favourite-books
    'contemporary',    -- proposed; a subgenre in favourite-books
    'western',         -- favourite-books, as a subgenre there
    'drama',           -- proposed; a trope in favourite-books
    'satire',          -- proposed
    'literary',        -- proposed
    'slice_of_life',   -- proposed
    'absurdist'        -- proposed — the seed's Absurd has no other home
    );

-- Two models are mixed in here and only one should survive. favourite-books treats a subgenre
-- as a modifier that composes with a genre — Dark + Fantasy, Hard + Science Fiction — which is
-- why Dark, High, Low and Cozy appear alone; forty of them cover what a hundred compound names
-- would. The proposed values are compound names instead, which display on their own but
-- multiply. Picking the modifier model means the label a member reads is composed from two
-- fields, which German does not do as neatly as English.
CREATE TYPE public.story_subgenre AS ENUM (
    'action',                 -- favourite-books — repeats the genre list, as it does there
    'adventure',              -- favourite-books — repeats the genre list
    'comedy',                 -- favourite-books — repeats the genre list
    'crime',                  -- favourite-books — repeats the genre list; proposed as a compound too
    'mystery',                -- favourite-books — repeats the genre list
    'fantasy',                -- favourite-books — repeats the genre list
    'horror',                 -- favourite-books — repeats the genre list
    'science_fiction',        -- favourite-books — repeats the genre list
    'science_fantasy',        -- favourite-books — repeats the genre list
    'romance',                -- favourite-books — repeats the genre list
    'new_adult',              -- favourite-books
    'young_adult',            -- favourite-books
    'classic',                -- favourite-books
    'epic',                   -- favourite-books modifier
    'historical',             -- favourite-books modifier
    'realistic',              -- favourite-books modifier
    'thriller',               -- favourite-books
    'suspense',               -- favourite-books
    'erotic',                 -- favourite-books modifier
    'political',              -- favourite-books modifier
    'psychological',          -- favourite-books modifier
    'romantasy',              -- favourite-books; proposed too
    'urban',                  -- favourite-books modifier
    'western',                -- favourite-books
    'cozy',                   -- favourite-books modifier — stored as 'Cozy ' there, with a trailing space
    'locked_room',            -- favourite-books
    'contemporary',           -- favourite-books modifier
    'dark',                   -- favourite-books modifier
    'fairytale',              -- favourite-books; proposed as fairy_tale
    'gothic',                 -- favourite-books
    'hard',                   -- favourite-books modifier
    'high',                   -- favourite-books modifier
    'low',                    -- favourite-books modifier
    'mythic',                 -- favourite-books modifier; proposed as mythology
    'paranormal',             -- favourite-books modifier
    'apocalyptic',            -- favourite-books; proposed as post_apocalyptic
    'utopia',                 -- favourite-books
    'dystopia',               -- both
    'nautical',               -- favourite-books modifier
    'subterranean',           -- favourite-books modifier
    'planetary',              -- favourite-books modifier
    'heroic',                 -- favourite-books modifier
    'supernatural',           -- both
    'high_fantasy',           -- proposed compound
    'dark_fantasy',           -- proposed compound
    'urban_fantasy',          -- proposed compound
    'mythology',              -- proposed
    'cyberpunk',              -- proposed; a trope in favourite-books
    'space_opera',            -- proposed compound
    'post_apocalyptic',       -- proposed compound
    'time_travel',            -- proposed; a trope in favourite-books
    'dark_romance',           -- proposed compound
    'contemporary_romance',   -- proposed compound
    'historical_romance',     -- proposed compound
    'detective',              -- proposed; a trope in favourite-books
    'psychological_thriller', -- proposed compound
    'spy',                    -- proposed
    'ghost_story',            -- proposed
    'body_horror',            -- proposed compound
    'medieval',               -- proposed
    'victorian',              -- proposed
    'antiquity',              -- proposed
    'war_story',              -- proposed; War is a trope in favourite-books
    'coming_of_age',          -- proposed; a trope in favourite-books
    'family_saga',            -- proposed
    'dark_academia'           -- proposed; Academy is a trope in favourite-books
    );

-- The list the issue predicts will outgrow itself, so it is the one most worth cutting hard.
-- Several values sit in a different list here than in favourite-books; where a concept appears
-- in two enums a member has to guess which one to fill in, so those pairs want resolving.
CREATE TYPE public.story_trope AS ENUM (
    'chosen_one',               -- both
    'quest',                    -- both
    'love_triangle',            -- both
    'unreliable_narrator',      -- both
    'enemies_to_lovers',        -- both
    'forced_proximity',         -- both
    'forbidden_love',           -- both
    'fake_relationship',        -- both
    'found_family',             -- both
    'revenge',                  -- both
    'second_chance',            -- both — 'Second-Chance love' in favourite-books
    'mentor',                   -- favourite-books
    'academy',                  -- favourite-books
    'school',                   -- favourite-books
    'reluctant_ruler',          -- favourite-books
    'reluctant_hero',           -- favourite-books
    'secret_society',           -- favourite-books
    'hidden_world',             -- favourite-books
    'prophecy',                 -- favourite-books
    'ultimate_evil',            -- favourite-books
    'newfound_powers',          -- favourite-books
    'coming_of_age',            -- favourite-books; proposed as a subgenre
    'time_travel',              -- favourite-books; proposed as a subgenre
    'alternate_universes',      -- favourite-books
    'meet_cute',                -- favourite-books
    'meet_cringe',              -- favourite-books
    'love_at_first_sight',      -- favourite-books
    'lovers_to_enemies',        -- favourite-books
    'imbalanced_dynamics',      -- favourite-books
    'forced_marriage',          -- favourite-books
    'detective',                -- favourite-books; proposed as a subgenre
    'amateur_sleuth',           -- favourite-books — 'Amateur' there, which says nothing on its own
    'bloodstained_family',      -- favourite-books
    'ticking_clock',            -- favourite-books
    'hidden_affair',            -- favourite-books
    'treasure_hunt',            -- favourite-books
    'puzzles_and_riddles',      -- favourite-books
    'double_agent',             -- favourite-books
    'everyman_turned_hero',     -- favourite-books
    'high_stakes',              -- favourite-books
    'monsters',                 -- favourite-books
    'bargains',                 -- favourite-books
    'creepy_old_house',         -- favourite-books
    'inheritance_with_strings', -- favourite-books
    'stranded',                 -- favourite-books
    'celebrity',                -- favourite-books
    'underdog',                 -- favourite-books
    'self_sacrifice',           -- favourite-books
    'best_friends',             -- favourite-books
    'pregnancy',                -- favourite-books
    'military',                 -- favourite-books
    'office',                   -- favourite-books
    'sport',                    -- favourite-books
    'millionaire',              -- favourite-books
    'regency',                  -- favourite-books
    'amnesia',                  -- favourite-books
    'blackmail',                -- favourite-books
    'war',                      -- favourite-books; also proposed as a content warning
    'trauma',                   -- favourite-books; overlaps what story_content_warning is for
    'drama',                    -- favourite-books; proposed as a genre
    'fated_mates',              -- favourite-books
    'grumpy_x_sunshine',        -- favourite-books
    'aliens',                   -- favourite-books
    'cyberpunk',                -- favourite-books; proposed as a subgenre
    'stalker',                  -- favourite-books
    'friends_to_lovers',        -- proposed
    'slow_burn',                -- proposed — in the seed
    'rivals',                   -- proposed
    'survival',                 -- proposed
    'redemption',               -- proposed
    'secret_identity',          -- proposed
    'morally_grey',             -- proposed
    'epistolary',               -- proposed — in the seed
    'chamber_piece',            -- proposed — in the seed, as Kammerspiel
    'ensemble'                  -- proposed — collaborative fiction is disproportionately this
    );

-- Tense and perspective come from a member describing what they want to know about a writing
-- partner: "erste Person oder dritte Person, Roman, Vergangenheit oder Gegenwart" (interviews,
-- 4.6). favourite-books has nothing for either, so every value here is proposed.
--
-- `mixed` is what keeps the old free-text reasoning true: a story that changes tense across
-- chapters can still say so.
CREATE TYPE public.story_tense AS ENUM (
    'past',    -- proposed — in the seed
    'present', -- proposed
    'mixed'    -- proposed — the case the free-text column existed for
    );

CREATE TYPE public.story_perspective AS ENUM (
    'first_person',            -- proposed — from the interviews, 4.6
    'second_person',           -- proposed
    'third_person_limited',    -- proposed — in the seed
    'third_person_omniscient', -- proposed
    'mixed'                    -- proposed — one writer per character is the norm here
    );

-- The one list where too short does harm rather than inconvenience: a warning that cannot be
-- given is a warning a reader does not get. The first three match report_category's own values
-- deliberately, so a missing_content_warning report names a warning that exists.
CREATE TYPE public.story_content_warning AS ENUM (
    'violence',        -- proposed — matches report_category
    'sexual_content',  -- proposed — matches report_category
    'self_harm',       -- proposed — matches report_category
    'suicide',         -- proposed
    'death',           -- proposed
    'grief',           -- proposed — in the seed, as Trauer
    'abuse',           -- proposed
    'sexual_violence', -- proposed
    'substance_abuse', -- proposed
    'eating_disorder', -- proposed
    'mental_illness',  -- proposed
    'discrimination',  -- proposed
    'gore',            -- proposed
    'war',             -- proposed — also a trope in favourite-books
    'animal_cruelty',  -- proposed
    'pregnancy_loss'   -- proposed
    );

-- A group holds one story for now. §5.1 has a group *containing* optional stories, and §43
-- puts that split in phase 2; until then the story's metadata lives on the group, and moving
-- it later is a migration rather than a redesign.
CREATE TABLE public.writing_group
(
    id               UUID PRIMARY KEY                         DEFAULT uuidv7(),
    title            TEXT                            NOT NULL,
    subtitle         TEXT,

    -- What the back cover says, at length. One word for it here and on story_idea, because an
    -- idea and the group it becomes carry the same text and two names would need a mapping.
    synopsis         TEXT                            NOT NULL,

    visibility       public.writing_group_visibility NOT NULL DEFAULT 'private',

    -- Story metadata. Every field optional: members told us Yooco's mandatory profile section
    -- got filled with nonsense purely to get past it, and a metadata block nobody means is
    -- worse than an empty one. Arrays are NOT NULL DEFAULT '{}', so "nothing given" has a
    -- single representation and reads never have to handle null.
    -- Named story_status, not status: the reader's own membership status is already called
    -- that everywhere a group is read. Not null, unlike the rest of the metadata — every
    -- story is at some point in its life, and 'planning' is where a new one starts.
    story_status     public.writing_group_story_status NOT NULL DEFAULT 'planning',
    genres           public.story_genre[]              NOT NULL DEFAULT '{}',
    subgenres        public.story_subgenre[]           NOT NULL DEFAULT '{}',
    tropes           public.story_trope[]              NOT NULL DEFAULT '{}',
    content_warnings public.story_content_warning[]    NOT NULL DEFAULT '{}',

    -- Chosen from a list rather than typed, for the reason story_language gives above. The
    -- free text this replaced argued that collaborative fiction mixes tense and person across
    -- chapters; that is right, and it is what the `mixed` value is for.
    tense            public.story_tense,
    perspective      public.story_perspective,

    language         public.story_language           NOT NULL DEFAULT 'german',

    created_by       uuid                            references public.user (id) on update cascade on delete set null,
    created_at       TIMESTAMPTZ                     NOT NULL DEFAULT now()
);

---

CREATE TYPE public.user_in_writing_group_role AS ENUM ('administrator', 'writer', 'reader');

CREATE TYPE public.user_in_writing_group_status AS ENUM ('invited', 'joined');

CREATE TABLE public.user_in_writing_group
(
    user_id          UUID                                NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,
    writing_group_id UUID                                NOT NULL REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (user_id, writing_group_id),
    role             public.user_in_writing_group_role   not null,
    status           public.user_in_writing_group_status not null,

    invited_at       TIMESTAMPTZ,
    joined_at        TIMESTAMPTZ,

    -- Who did the inviting. Null for the founder of a group, who was invited by nobody, and
    -- null again once that account is gone — the membership outlives whoever opened the door.
    invited_by       UUID                                REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at       TIMESTAMPTZ                         NOT NULL DEFAULT now()
);

---

CREATE FUNCTION public.set_invited_joined_at_for_user_in_writing_group()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        NEW.invited_at = now();

        IF NEW.status = 'joined' THEN
            NEW.joined_at = now();
        END IF;

    ELSIF NEW.status = 'joined' AND OLD.status IS DISTINCT FROM 'joined' THEN
        NEW.joined_at = now();

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invited_joined_at_for_user_in_writing_group
    BEFORE INSERT OR UPDATE
    ON public.user_in_writing_group
    FOR EACH ROW
EXECUTE FUNCTION public.set_invited_joined_at_for_user_in_writing_group();

---

CREATE FUNCTION public.delete_writing_group_after_last_user_leaves()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    -- Two members leaving at once would otherwise each still see the other's row, so neither
    -- deletes and the group is left with nobody in it. Taking the groups' row locks first
    -- serialises them; the DELETE below is a separate statement and so re-reads, seeing the
    -- other transaction's committed departure rather than this one's original snapshot.
    PERFORM 1
    FROM public.writing_group
    WHERE id = OLD.writing_group_id
        FOR UPDATE;

    DELETE
    FROM public.writing_group AS wg
    WHERE wg.id = OLD.writing_group_id
      AND NOT EXISTS (SELECT true FROM public.user_in_writing_group AS uiwg WHERE uiwg.writing_group_id = wg.id);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delete_writing_group_after_last_user_leaves
    AFTER DELETE
    ON public.user_in_writing_group
    FOR EACH ROW
EXECUTE FUNCTION public.delete_writing_group_after_last_user_leaves();

---

CREATE INDEX writing_group_created_by_idx ON public.writing_group (created_by);
-- The primary key leads with user_id, so listing a group's members cannot use it.
CREATE INDEX user_in_writing_group_writing_group_id_idx
    ON public.user_in_writing_group (writing_group_id);

-- migrate:down

DROP TABLE public.user_in_writing_group;
DROP FUNCTION public.set_invited_joined_at_for_user_in_writing_group();
DROP TABLE public.writing_group;

DROP FUNCTION public.delete_writing_group_after_last_user_leaves();

DROP TYPE public.user_in_writing_group_status;
DROP TYPE public.story_language;
DROP TYPE public.user_in_writing_group_role;
DROP TYPE public.writing_group_visibility;
DROP TYPE public.writing_group_story_status;

DROP TYPE public.story_content_warning;
DROP TYPE public.story_perspective;
DROP TYPE public.story_tense;
DROP TYPE public.story_trope;
DROP TYPE public.story_subgenre;
DROP TYPE public.story_genre;
