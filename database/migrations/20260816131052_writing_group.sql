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
-- Genre is the only one of the three anybody asked for: members named it unprompted (interviews,
-- 4.2 and 4.6), §7.5 lists it and §8.2 filters by it. Subgenre and trope are ours. They are kept
-- short for that reason — a vocabulary nobody has used yet is a guess, and a filter whose options
-- mostly return nothing reads as broken rather than as empty.
CREATE TYPE public.story_genre AS ENUM (
    'action',
    'adventure',
    'comedy',
    'crime',
    'drama',
    'fantasy',
    'historical',
    'horror',
    'literary',
    'mystery',
    'retelling',
    'romance',
    'science_fiction',
    'slice_of_life',
    'thriller',
    'western'
    );

-- Grouped by the genre each sits under, as a comment because an enum cannot carry the relation:
-- nothing here stops 'space_opera' on a romance. Whether that becomes a lookup table, a CHECK or
-- a pairing the frontend merely draws is #75's open question, and this list is deliberately
-- written so the grouping can be lifted out of it unchanged.
--
-- The grouping is also what makes the length affordable — a member who picked Fantasy chooses
-- among six, never among sixty.
CREATE TYPE public.story_subgenre AS ENUM (
    -- Fantasy
    'high_fantasy',
    'dark_fantasy',
    'urban_fantasy',
    'portal_fantasy',
    'fairy_tale',
    'mythic_fantasy',
    'paranormal_fantasy',
    'time_travel_fantasy',

    -- Science fiction
    'space_opera',
    'cyberpunk',
    'dystopian',
    'post_apocalyptic',
    'time_travel',
    'first_contact',

    -- Retelling
    'retold_book',
    'retold_movie',
    'retold_myth',
    'retold_saga',
    'retold_manga',

    -- Romance
    'contemporary_romance',
    'historical_romance',
    'romantic_fantasy',
    'forbidden_romance',
    'cosy_romance',
    'comedy_romance',
    'closed_door_romance',
    'erotic_romance',

    -- Mystery
    'intrigue',
    'detective',
    'cosy_mystery',
    'noir',
    'whodunit',

    -- Crime
    'heist',
    'organised_crime',
    'police_procedural',

    -- Thriller
    'psychological_thriller',
    'spy_thriller',
    'legal_thriller',
    'survival_thriller',

    -- Horror
    'gothic_horror',
    'supernatural_horror',
    'psychological_horror',
    'creature_horror',
    'body_horror',
    'doll_horror',

    -- Historical
    'ancient_world',
    'medieval',
    'early_modern',
    'victorian',
    'world_war',
    'twentieth_century',

    -- Adventure
    'quest',
    'exploration',
    'treasure_hunt',
    'survival_adventure',

    -- Action
    'military_action',
    'martial_arts',
    'superhero',
    'spy_action',

    -- Comedy
    'romantic_comedy',
    'satire',
    'parody',
    'dark_comedy',

    -- Drama
    'family_drama',
    'coming_of_age',
    'tragedy',

    -- Slice of life
    'everyday_life',
    'workplace',
    'school_life',
    'university_life',
    'family_life',
    'vacation',

    -- Western
    'classic_western',
    'weird_western',

    -- Literary
    'magical_realism',
    'experimental'
    );

-- The weakest evidence of the three: no member named a trope in any interview, and neither the
-- PRD nor the Yooco report contains the word. Short on purpose until somebody uses one, and the
-- first list here to expect deleting rather than extending.
CREATE TYPE public.story_trope AS ENUM (
    'enemies_to_lovers',
    'friends_to_lovers',
    'friends_with_benefits',
    'slow_burn',
    'forbidden_love',
    'love_triangle',
    'fake_relationship',
    'second_chance',
    'found_family',
    'chosen_one',
    'mentor_and_student',
    'rivals',
    'redemption_arc',
    'villain_to_hero',
    'hero_to_villain',
    'hidden_identity',
    'secret_heritage',
    'amnesia',
    'time_loop',
    'quest_for_an_artefact',
    'heist_crew',
    'locked_room',
    'forced_proximity',
    'grumpy_and_sunshine',
    'unreliable_narrator',
    'epistolary', -- a form rather than a trope, and the odd one out for it
    'multiple_timelines',
    'ensemble_cast',
    'morally_grey_protagonist',
    'road_trip',
    'court_intrigue'
    );

CREATE TYPE public.story_tense AS ENUM (
    'past',    -- proposed
    'present', -- proposed
    'mixed'    -- proposed — the case the free-text column existed for
    );

CREATE TYPE public.story_perspective AS ENUM (
    'first_person',            -- proposed — from the interviews, 4.6
    'second_person',           -- proposed
    'third_person_limited',    -- proposed
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
    'grief',           -- proposed
    'abuse',           -- proposed
    'sexual_violence', -- proposed
    'substance_abuse', -- proposed
    'eating_disorder', -- proposed
    'mental_illness',  -- proposed
    'discrimination',  -- proposed
    'gore',            -- proposed
    'war',             -- proposed
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

    -- Free text, not lists. Both were put to beta testers as vocabularies and both came back
    -- untouched — not one value added to either, while the genre lists grew by twenty-one — and
    -- the only comments on them asked for a plain field. So they describe rather than filter, and
    -- what gets written here is what decides whether they stay.
    -- Prefixed like `story_status` above, and for the same reason: `settings` alone reads as the
    -- group's configuration, which is a thing the product also has.
    story_themes     TEXT,
    story_settings   TEXT,

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
-- Partial: most memberships are joined rather than invited.
CREATE INDEX user_in_writing_group_invited_by_idx
    ON public.user_in_writing_group (invited_by) WHERE invited_by IS NOT NULL;
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
