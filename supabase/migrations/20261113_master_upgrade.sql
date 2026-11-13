-- ============================================================================
-- PROYECTO ORQUESTA — MASTER NON-DESTRUCTIVE UPGRADE MIGRATION
-- Safe to run multiple times (idempotent). Preserves all existing data & users.
-- ============================================================================

-- 1. ORGANIZATIONS & PUBLIC IDENTITY (Logo + Cover sync)
CREATE OR REPLACE FUNCTION public.get_public_organization_identity()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'logo_url', o.logo_url,
        'cover_url', COALESCE(o.cover_url, o.social_links->>'cover_url'),
        'primary_color', o.primary_color,
        'social_links', COALESCE(o.social_links, '{}'::jsonb)
      )
      FROM public.organizations o
      ORDER BY o.created_at ASC
      LIMIT 1
    ),
    jsonb_build_object(
      'name', 'Proyecto Orquesta',
      'logo_url', '/assets/proyecto-orquesta-logo.png',
      'cover_url', '/assets/orquesta-stage-hero.png',
      'primary_color', '#5B21F4',
      'social_links', '{}'::jsonb
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_organization_identity() TO anon, authenticated;

-- 2. FIX PROFILE COMPLETION LOOP (Sync profiles + user_metadata + non-musicians)
UPDATE public.profiles p
SET profile_completed_at = COALESCE(p.profile_completed_at, now())
FROM public.musicians m
WHERE m.user_id = p.id
  AND p.profile_completed_at IS NULL
  AND COALESCE(length(trim(m.phone)), 0) >= 2
  AND COALESCE(length(trim(m.address)), 0) >= 2
  AND COALESCE(length(trim(m.eps)), 0) >= 2
  AND COALESCE(length(trim(m.emergency_contact_name)), 0) >= 2;

CREATE OR REPLACE FUNCTION public.finish_my_profile_setup(
  profile_data jsonb,
  selected_instrument_id uuid DEFAULT NULL,
  selected_role_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_musician_id uuid;
  v_org_id uuid;
  v_first text := trim(COALESCE(profile_data->>'first_name', ''));
  v_last text := trim(COALESCE(profile_data->>'last_name', ''));
  v_email text := NULLIF(trim(COALESCE(profile_data->>'email', '')), '');
  v_now timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida';
  END IF;

  UPDATE public.profiles
  SET
    first_name = COALESCE(NULLIF(v_first, ''), first_name),
    last_name = COALESCE(NULLIF(v_last, ''), last_name),
    profile_completed_at = COALESCE(profile_completed_at, v_now),
    updated_at = v_now
  WHERE id = v_user_id;

  SELECT id, organization_id INTO v_musician_id, v_org_id
  FROM public.musicians
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_musician_id IS NOT NULL THEN
    UPDATE public.musicians
    SET
      first_name = COALESCE(NULLIF(v_first, ''), first_name),
      last_name = COALESCE(NULLIF(v_last, ''), last_name),
      email = v_email,
      document_type = COALESCE(NULLIF(profile_data->>'document_type', ''), document_type),
      document_number = NULLIF(trim(COALESCE(profile_data->>'document_number', '')), ''),
      birth_date = CASE WHEN COALESCE(profile_data->>'birth_date', '') <> '' THEN (profile_data->>'birth_date')::date ELSE birth_date END,
      phone = NULLIF(trim(COALESCE(profile_data->>'phone', '')), ''),
      whatsapp = NULLIF(trim(COALESCE(profile_data->>'whatsapp', '')), ''),
      address = NULLIF(trim(COALESCE(profile_data->>'address', '')), ''),
      eps = NULLIF(trim(COALESCE(profile_data->>'eps', '')), ''),
      cali_commune = CASE WHEN COALESCE(profile_data->>'cali_commune', '') ~ '^\d+$' THEN (profile_data->>'cali_commune')::int ELSE NULL END,
      emergency_contact_name = NULLIF(trim(COALESCE(profile_data->>'emergency_contact_name', '')), ''),
      emergency_contact_phone = NULLIF(trim(COALESCE(profile_data->>'emergency_contact_phone', '')), ''),
      level = COALESCE(NULLIF(profile_data->>'level', ''), level),
      specialty = NULLIF(trim(COALESCE(profile_data->>'specialty', '')), ''),
      experience_years = CASE WHEN COALESCE(profile_data->>'experience_years', '') ~ '^\d+$' THEN (profile_data->>'experience_years')::int ELSE NULL END,
      biography = NULLIF(trim(COALESCE(profile_data->>'biography', '')), ''),
      updated_at = v_now
    WHERE id = v_musician_id;

    IF selected_instrument_id IS NOT NULL THEN
      DELETE FROM public.musician_instruments WHERE musician_id = v_musician_id AND is_primary = true;
      INSERT INTO public.musician_instruments (organization_id, musician_id, instrument_id, is_primary, proficiency)
      VALUES (v_org_id, v_musician_id, selected_instrument_id, true, COALESCE(NULLIF(profile_data->>'level', ''), 'INTERMEDIO'))
      ON CONFLICT DO NOTHING;
    END IF;

    IF selected_role_id IS NOT NULL THEN
      DELETE FROM public.musician_roles WHERE musician_id = v_musician_id AND is_primary = true;
      INSERT INTO public.musician_roles (organization_id, musician_id, musical_role_id, is_primary)
      VALUES (v_org_id, v_musician_id, selected_role_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_my_profile_setup(jsonb, uuid, uuid) TO authenticated;

-- 3. NEW PERMISSIONS & ROLE "PRODUCTION_TECH" + ROLE ADJUSTMENTS
INSERT INTO public.permissions (key, module, description)
VALUES
  ('projects.view', 'projects', 'Consultar proyectos y objetivos'),
  ('projects.manage', 'projects', 'Crear y gestionar proyectos y tareas'),
  ('swot.view', 'strategy', 'Consultar Matriz DOFA y brechas'),
  ('swot.manage', 'strategy', 'Gestionar Matriz DOFA y análisis de brechas'),
  ('contracts.manage', 'commercial', 'Generar y gestionar contratos'),
  ('inventory.view', 'technical', 'Consultar inventario técnico'),
  ('inventory.manage', 'technical', 'Gestionar equipos, reservas y mantenimiento'),
  ('evaluations.manage', 'rehearsals', 'Evaluar ensayos (semáforo) y músicos')
ON CONFLICT (key) DO NOTHING;

-- Ensure ADMIN has all permissions in every org
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Ensure DIRECTOR_MUSICAL has evaluations.manage and does NOT have tasks.self ("Mi trabajo musical")
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('evaluations.manage')
WHERE r.code IN ('DIRECTOR_MUSICAL', 'DIRECTOR')
ON CONFLICT DO NOTHING;

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.code = 'DIRECTOR_MUSICAL'
  AND p.key = 'tasks.self';

UPDATE public.roles
SET name = 'Director Musical / Instructor',
    description = 'Instructor y dirección artística: planificación, evaluación y seguimiento del equipo musical.'
WHERE code = 'DIRECTOR_MUSICAL';

-- Seed PRODUCTION_TECH role for every organization
INSERT INTO public.roles (organization_id, name, code, description, is_system)
SELECT o.id, 'Producción Técnica y Logística', 'PRODUCTION_TECH', 'Gestión de rider técnico, logística, montaje e inventario de equipos.', true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE r.organization_id = o.id AND r.code = 'PRODUCTION_TECH'
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('dashboard.view', 'events.manage', 'technical.manage', 'inventory.view', 'inventory.manage', 'rehearsals.view')
WHERE r.code = 'PRODUCTION_TECH'
ON CONFLICT DO NOTHING;

-- 4. FORCE DELETE MUSICIAN WITH HISTORY PRESERVATION
ALTER TABLE public.event_musicians ADD COLUMN IF NOT EXISTS musician_name_snapshot text;
ALTER TABLE public.rehearsal_attendance ADD COLUMN IF NOT EXISTS musician_name_snapshot text;
ALTER TABLE public.rehearsal_contributions ADD COLUMN IF NOT EXISTS musician_name_snapshot text;
ALTER TABLE public.rehearsal_musicians ADD COLUMN IF NOT EXISTS musician_name_snapshot text;
ALTER TABLE public.music_task_assignees ADD COLUMN IF NOT EXISTS musician_name_snapshot text;

-- Allow musician_id to become nullable on historical tables when a musician is permanently deleted
DO $$
BEGIN
  ALTER TABLE public.event_musicians ALTER COLUMN musician_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.rehearsal_attendance ALTER COLUMN musician_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.rehearsal_contributions ALTER COLUMN musician_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.rehearsal_musicians ALTER COLUMN musician_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.music_task_assignees ALTER COLUMN musician_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.admin_force_delete_musician(
  target_organization_id uuid,
  target_musician_id uuid,
  anonymize_history boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_musician record;
  v_snapshot text;
  v_user_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.has_org_permission(target_organization_id, 'users.approve') THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar músicos';
  END IF;

  SELECT id, user_id, first_name, last_name, status INTO v_musician
  FROM public.musicians
  WHERE id = target_musician_id AND organization_id = target_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Músico no encontrado';
  END IF;

  v_user_id := v_musician.user_id;
  IF v_user_id = v_actor THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia ficha de músico';
  END IF;

  v_snapshot := CASE WHEN anonymize_history THEN 'Músico retirado (anonimizado)' ELSE trim(v_musician.first_name || ' ' || v_musician.last_name) END;

  -- Preserve historical rows with snapshot and detach FK
  UPDATE public.event_musicians SET musician_name_snapshot = COALESCE(musician_name_snapshot, v_snapshot), musician_id = NULL WHERE musician_id = target_musician_id;
  UPDATE public.rehearsal_attendance SET musician_name_snapshot = COALESCE(musician_name_snapshot, v_snapshot), musician_id = NULL WHERE musician_id = target_musician_id;
  UPDATE public.rehearsal_contributions SET musician_name_snapshot = COALESCE(musician_name_snapshot, v_snapshot), musician_id = NULL WHERE musician_id = target_musician_id;
  UPDATE public.music_task_assignees SET musician_name_snapshot = COALESCE(musician_name_snapshot, v_snapshot), musician_id = NULL WHERE musician_id = target_musician_id;
  DELETE FROM public.rehearsal_musicians WHERE musician_id = target_musician_id;
  DELETE FROM public.availability WHERE musician_id = target_musician_id;
  DELETE FROM public.musician_instruments WHERE musician_id = target_musician_id;
  DELETE FROM public.musician_roles WHERE musician_id = target_musician_id;
  UPDATE public.rehearsals SET responsible_musician_id = NULL WHERE responsible_musician_id = target_musician_id;

  DELETE FROM public.musicians WHERE id = target_musician_id AND organization_id = target_organization_id;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.organization_memberships WHERE organization_id = target_organization_id AND user_id = v_user_id;
  END IF;

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, previous_value, new_value)
  VALUES (target_organization_id, v_actor, 'DELETE', 'musician', target_musician_id,
    jsonb_build_object('name', trim(v_musician.first_name || ' ' || v_musician.last_name), 'user_id', v_user_id),
    jsonb_build_object('deleted', true, 'anonymized', anonymize_history, 'history_preserved', true)
  );

  RETURN jsonb_build_object('deleted_musician_id', target_musician_id, 'detached_user_id', v_user_id, 'snapshot', v_snapshot);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_force_delete_musician(uuid, uuid, boolean) TO authenticated;

-- 5. REHEARSAL CONTRIBUTIONS ENHANCEMENTS
ALTER TABLE public.rehearsal_contributions ADD COLUMN IF NOT EXISTS concept text;
ALTER TABLE public.rehearsal_contributions ADD COLUMN IF NOT EXISTS contribution_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.rehearsal_costs ADD COLUMN IF NOT EXISTS cost_date date;

-- 6. MULTIPLE CATEGORIZED SCORES PER SONG
CREATE TABLE IF NOT EXISTS public.song_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  instrument text,
  file_url text NOT NULL,
  description text,
  version text DEFAULT '1.0',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.song_scores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org members read song_scores" ON public.song_scores FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = song_scores.organization_id AND om.user_id = auth.uid() AND om.approval_status = 'APPROVED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org editors manage song_scores" ON public.song_scores FOR ALL
  USING (public.has_org_permission(organization_id, 'repertoire.manage'))
  WITH CHECK (public.has_org_permission(organization_id, 'repertoire.manage'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. SEMAPHORE EVALUATIONS (REHEARSALS & INDIVIDUAL MUSICIANS)
CREATE TABLE IF NOT EXISTS public.rehearsal_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rehearsal_id uuid NOT NULL REFERENCES public.rehearsals(id) ON DELETE CASCADE,
  evaluator_user_id uuid NOT NULL,
  evaluator_name text NOT NULL,
  semaphore text NOT NULL CHECK (semaphore IN ('VERDE', 'AMARILLO', 'ROJO')),
  score integer CHECK (score BETWEEN 0 AND 100),
  progress_percent integer CHECK (progress_percent BETWEEN 0 AND 100),
  strengths text,
  improvements text,
  general_notes text,
  song_notes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.musician_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rehearsal_id uuid REFERENCES public.rehearsals(id) ON DELETE SET NULL,
  musician_id uuid NOT NULL REFERENCES public.musicians(id) ON DELETE CASCADE,
  evaluator_user_id uuid NOT NULL,
  evaluator_name text NOT NULL,
  semaphore text NOT NULL CHECK (semaphore IN ('VERDE', 'AMARILLO', 'ROJO')),
  score integer CHECK (score BETWEEN 0 AND 100),
  strengths text,
  improvements text,
  recommendations text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rehearsal_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.musician_evaluations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "read evaluations" ON public.rehearsal_evaluations FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = rehearsal_evaluations.organization_id AND om.user_id = auth.uid() AND om.approval_status = 'APPROVED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "manage evaluations" ON public.rehearsal_evaluations FOR ALL USING (public.has_org_permission(organization_id, 'rehearsals.manage') OR public.has_org_permission(organization_id, 'evaluations.manage') OR public.has_org_permission(organization_id, 'tasks.manage')) WITH CHECK (public.has_org_permission(organization_id, 'rehearsals.manage') OR public.has_org_permission(organization_id, 'evaluations.manage') OR public.has_org_permission(organization_id, 'tasks.manage'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "read musician evaluations" ON public.musician_evaluations FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = musician_evaluations.organization_id AND om.user_id = auth.uid() AND om.approval_status = 'APPROVED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "manage musician evaluations" ON public.musician_evaluations FOR ALL USING (public.has_org_permission(organization_id, 'rehearsals.manage') OR public.has_org_permission(organization_id, 'evaluations.manage') OR public.has_org_permission(organization_id, 'tasks.manage')) WITH CHECK (public.has_org_permission(organization_id, 'rehearsals.manage') OR public.has_org_permission(organization_id, 'evaluations.manage') OR public.has_org_permission(organization_id, 'tasks.manage'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. CONTRACTS MODULE + DIGITAL SIGNATURE
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_number text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'BORRADOR' CHECK (status IN ('BORRADOR', 'ENVIADO', 'FIRMADO', 'ANULADO')),
  public_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  total_amount numeric NOT NULL DEFAULT 0,
  deposit_amount numeric NOT NULL DEFAULT 0,
  balance_amount numeric NOT NULL DEFAULT 0,
  clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  body_text text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  sent_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signer_document text,
  signer_email text,
  signature_data_url text,
  signature_metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "org read contracts" ON public.contracts FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = contracts.organization_id AND om.user_id = auth.uid() AND om.approval_status = 'APPROVED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "org manage contracts" ON public.contracts FOR ALL USING (public.has_org_permission(organization_id, 'quotes.manage') OR public.has_org_permission(organization_id, 'events.manage') OR public.has_org_permission(organization_id, 'contracts.manage')) WITH CHECK (public.has_org_permission(organization_id, 'quotes.manage') OR public.has_org_permission(organization_id, 'events.manage') OR public.has_org_permission(organization_id, 'contracts.manage'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.get_public_contract(access_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract record;
  v_org record;
  v_client record;
  v_event record;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE public_token = access_token LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT name, logo_url, primary_color, phone, whatsapp, email INTO v_org FROM public.organizations WHERE id = v_contract.organization_id;
  SELECT full_name, company, nit, email, phone, city INTO v_client FROM public.clients WHERE id = v_contract.client_id;
  SELECT name, event_date, start_time, end_time, city, venue, address INTO v_event FROM public.events WHERE id = v_contract.event_id;

  RETURN jsonb_build_object(
    'contract', to_jsonb(v_contract),
    'organization', to_jsonb(v_org),
    'client', COALESCE(to_jsonb(v_client), '{}'::jsonb),
    'event', COALESCE(to_jsonb(v_event), '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_public_contract(
  access_token text,
  signer_full_name text,
  signer_doc text,
  signer_mail text,
  signature_image text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE public_token = access_token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato no encontrado'; END IF;
  IF v_contract.status = 'FIRMADO' THEN RAISE EXCEPTION 'Este contrato ya fue firmado y está bloqueado'; END IF;
  IF v_contract.status = 'ANULADO' THEN RAISE EXCEPTION 'Este contrato fue anulado'; END IF;

  UPDATE public.contracts
  SET
    status = 'FIRMADO',
    signed_at = now(),
    signer_name = trim(signer_full_name),
    signer_document = NULLIF(trim(signer_doc), ''),
    signer_email = NULLIF(trim(signer_mail), ''),
    signature_data_url = signature_image,
    signature_metadata = jsonb_build_object('signed_via', 'public_link', 'accepted_terms', true, 'timestamp', now()),
    updated_at = now()
  WHERE id = v_contract.id
  RETURNING * INTO v_contract;

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, new_value)
  VALUES (v_contract.organization_id, NULL, 'SIGN', 'contract', v_contract.id, jsonb_build_object('signer_name', signer_full_name, 'signed_at', v_contract.signed_at));

  RETURN to_jsonb(v_contract);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_contract(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_public_contract(text, text, text, text, text) TO anon, authenticated;

-- 9. SWOT MATRIX (DOFA) & GAPS
CREATE TABLE IF NOT EXISTS public.swot_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quadrant text NOT NULL CHECK (quadrant IN ('FORTALEZA', 'DEBILIDAD', 'OPORTUNIDAD', 'AMENAZA')),
  title text NOT NULL,
  description text,
  impact text NOT NULL DEFAULT 'MEDIO' CHECK (impact IN ('BAJO', 'MEDIO', 'ALTO', 'CRÍTICO')),
  priority integer NOT NULL DEFAULT 2,
  responsible text,
  target_date date,
  status text NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'EN PROCESO', 'RESUELTO', 'ARCHIVADO')),
  strategic_action text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.swot_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  area text NOT NULL,
  current_state text NOT NULL,
  desired_state text NOT NULL,
  gap_description text NOT NULL,
  action_plan text NOT NULL,
  responsible text,
  priority text NOT NULL DEFAULT 'ALTA' CHECK (priority IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
  status text NOT NULL DEFAULT 'IDENTIFICADA' CHECK (status IN ('IDENTIFICADA', 'EN PLAN', 'EN PROGRESO', 'CERRADA')),
  due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.swot_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swot_gaps ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "read swot" ON public.swot_factors FOR SELECT USING (public.has_org_permission(organization_id, 'swot.view') OR public.has_org_permission(organization_id, 'swot.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "manage swot" ON public.swot_factors FOR ALL USING (public.has_org_permission(organization_id, 'swot.manage')) WITH CHECK (public.has_org_permission(organization_id, 'swot.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read swot gaps" ON public.swot_gaps FOR SELECT USING (public.has_org_permission(organization_id, 'swot.view') OR public.has_org_permission(organization_id, 'swot.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "manage swot gaps" ON public.swot_gaps FOR ALL USING (public.has_org_permission(organization_id, 'swot.manage')) WITH CHECK (public.has_org_permission(organization_id, 'swot.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10. PROJECTS & OBJECTIVES MODULE
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Operativo',
  description text,
  status text NOT NULL DEFAULT 'PLANIFICADO' CHECK (status IN ('PLANIFICADO', 'EN CURSO', 'EN PAUSA', 'COMPLETADO', 'CANCELADO')),
  priority text NOT NULL DEFAULT 'ALTA' CHECK (priority IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
  owner_name text,
  start_date date,
  target_date date,
  budget numeric DEFAULT 0,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'EN PROGRESO', 'COMPLETADA', 'BLOQUEADA')),
  priority text NOT NULL DEFAULT 'MEDIA' CHECK (priority IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
  assignee_user_id uuid,
  assignee_name text,
  due_date date,
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  author_name text NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_comments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "read projects" ON public.projects FOR SELECT USING (public.has_org_permission(organization_id, 'projects.view') OR public.has_org_permission(organization_id, 'projects.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "manage projects" ON public.projects FOR ALL USING (public.has_org_permission(organization_id, 'projects.manage')) WITH CHECK (public.has_org_permission(organization_id, 'projects.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read project tasks" ON public.project_tasks FOR SELECT USING (public.has_org_permission(organization_id, 'projects.view') OR public.has_org_permission(organization_id, 'projects.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "manage project tasks" ON public.project_tasks FOR ALL USING (public.has_org_permission(organization_id, 'projects.manage') OR public.has_org_permission(organization_id, 'projects.view')) WITH CHECK (public.has_org_permission(organization_id, 'projects.manage') OR public.has_org_permission(organization_id, 'projects.view')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read project comments" ON public.project_task_comments FOR SELECT USING (public.has_org_permission(organization_id, 'projects.view') OR public.has_org_permission(organization_id, 'projects.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "write project comments" ON public.project_task_comments FOR INSERT WITH CHECK (public.has_org_permission(organization_id, 'projects.view') OR public.has_org_permission(organization_id, 'projects.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 11. TECHNICAL INVENTORY MODULE
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Sonido',
  code text,
  serial_number text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status text NOT NULL DEFAULT 'DISPONIBLE' CHECK (status IN ('DISPONIBLE', 'RESERVADO', 'EN USO', 'MANTENIMIENTO', 'DAÑADO', 'BAJA')),
  location text,
  photo_url text,
  notes text,
  maintenance_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'RESERVADO' CHECK (status IN ('DISPONIBLE', 'RESERVADO', 'ENTREGADO', 'DEVUELTO')),
  responsible_name text,
  notes text,
  checked_out_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "read inventory" ON public.inventory_items FOR SELECT USING (public.has_org_permission(organization_id, 'inventory.view') OR public.has_org_permission(organization_id, 'inventory.manage') OR public.has_org_permission(organization_id, 'technical.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "manage inventory" ON public.inventory_items FOR ALL USING (public.has_org_permission(organization_id, 'inventory.manage') OR public.has_org_permission(organization_id, 'technical.manage')) WITH CHECK (public.has_org_permission(organization_id, 'inventory.manage') OR public.has_org_permission(organization_id, 'technical.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read inventory res" ON public.inventory_reservations FOR SELECT USING (public.has_org_permission(organization_id, 'inventory.view') OR public.has_org_permission(organization_id, 'inventory.manage') OR public.has_org_permission(organization_id, 'technical.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "manage inventory res" ON public.inventory_reservations FOR ALL USING (public.has_org_permission(organization_id, 'inventory.manage') OR public.has_org_permission(organization_id, 'technical.manage')) WITH CHECK (public.has_org_permission(organization_id, 'inventory.manage') OR public.has_org_permission(organization_id, 'technical.manage')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12. SECURE ADMIN SECURITY QUESTION & RECOVERY (NO PLAINTEXT PASSWORDS)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_security_recovery (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  must_change_password boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_security_recovery ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "admin manages own security question" ON public.admin_security_recovery
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.configure_admin_security(
  target_organization_id uuid,
  security_question text,
  security_answer text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;
  SELECT r.code INTO v_role
  FROM public.organization_memberships om
  JOIN public.roles r ON r.id = om.role_id
  WHERE om.organization_id = target_organization_id AND om.user_id = v_user_id AND om.approval_status = 'APPROVED';

  IF v_role <> 'ADMIN' THEN
    RAISE EXCEPTION 'Solo el Administrador puede configurar esta pregunta de seguridad';
  END IF;

  INSERT INTO public.admin_security_recovery (user_id, organization_id, question, answer_hash, failed_attempts, locked_until, updated_at)
  VALUES (v_user_id, target_organization_id, trim(security_question), extensions.crypt(lower(trim(security_answer)), extensions.gen_salt('bf')), 0, NULL, now())
  ON CONFLICT (user_id) DO UPDATE
  SET question = EXCLUDED.question,
      answer_hash = EXCLUDED.answer_hash,
      failed_attempts = 0,
      locked_until = NULL,
      updated_at = now();

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, new_value)
  VALUES (target_organization_id, v_user_id, 'UPDATE', 'admin_security_question', v_user_id, jsonb_build_object('configured', true));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_security_question(identifier_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text := lower(trim(identifier_value));
  v_rec record;
BEGIN
  SELECT p.id AS user_id, p.first_name, om.organization_id, r.code AS role_code, asr.question, asr.locked_until
  INTO v_rec
  FROM public.profiles p
  JOIN public.organization_memberships om ON om.user_id = p.id AND om.approval_status = 'APPROVED'
  JOIN public.roles r ON r.id = om.role_id
  LEFT JOIN public.admin_security_recovery asr ON asr.user_id = p.id
  WHERE lower(COALESCE(p.email, '')) = v_clean
     OR lower(COALESCE(p.username, '')) = v_clean
     OR lower(COALESCE(p.email, '')) = (v_clean || '@usuarios.proyecto-orquesta.local')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'NOT_FOUND');
  END IF;

  IF v_rec.role_code <> 'ADMIN' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'NOT_ADMIN');
  END IF;

  IF v_rec.question IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'NO_QUESTION');
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'user_id', v_rec.user_id,
    'first_name', v_rec.first_name,
    'question', v_rec.question,
    'locked_until', v_rec.locked_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_admin_password_with_security_answer(
  identifier_value text,
  answer_value text,
  new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_clean text := lower(trim(identifier_value));
  v_user_id uuid;
  v_org_id uuid;
  v_rec public.admin_security_recovery%ROWTYPE;
BEGIN
  IF length(COALESCE(new_password, '')) < 8 THEN
    RAISE EXCEPTION 'La nueva contraseña debe tener mínimo 8 caracteres';
  END IF;

  SELECT p.id, om.organization_id INTO v_user_id, v_org_id
  FROM public.profiles p
  JOIN public.organization_memberships om ON om.user_id = p.id AND om.approval_status = 'APPROVED'
  JOIN public.roles r ON r.id = om.role_id AND r.code = 'ADMIN'
  WHERE lower(COALESCE(p.email, '')) = v_clean
     OR lower(COALESCE(p.username, '')) = v_clean
     OR lower(COALESCE(p.email, '')) = (v_clean || '@usuarios.proyecto-orquesta.local')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Solo el Administrador puede usar este método';
  END IF;

  SELECT * INTO v_rec FROM public.admin_security_recovery WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El Administrador no tiene pregunta de seguridad configurada';
  END IF;

  IF v_rec.locked_until IS NOT NULL AND v_rec.locked_until > now() THEN
    RAISE EXCEPTION 'Demasiados intentos fallidos. Intenta nuevamente en unos minutos.';
  END IF;

  IF extensions.crypt(lower(trim(answer_value)), v_rec.answer_hash) <> v_rec.answer_hash THEN
    UPDATE public.admin_security_recovery
    SET failed_attempts = failed_attempts + 1,
        locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
        updated_at = now()
    WHERE user_id = v_user_id;
    RAISE EXCEPTION 'La respuesta de seguridad no coincide';
  END IF;

  -- Update password hash directly in auth.users & revoke active refresh tokens
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = v_user_id;

  DELETE FROM auth.refresh_tokens WHERE user_id = v_user_id::text;

  UPDATE public.admin_security_recovery
  SET failed_attempts = 0, locked_until = NULL, must_change_password = false, updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, new_value)
  VALUES (v_org_id, v_user_id, 'SECURITY_RESET', 'admin_password', v_user_id, jsonb_build_object('method', 'security_question', 'sessions_revoked', true));

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.configure_admin_security(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_security_question(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_admin_password_with_security_answer(text, text, text) TO anon, authenticated;

-- 13. GLOBAL BIRTHDAY NOTIFICATIONS RPC (DEDUPLICATED DAILY)
CREATE OR REPLACE FUNCTION public.refresh_birthday_notifications(target_organization_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_month int := EXTRACT(MONTH FROM v_today);
  v_day int := EXTRACT(DAY FROM v_today);
  v_bday record;
  v_member record;
  v_count int := 0;
  v_title text;
  v_msg text;
BEGIN
  FOR v_bday IN
    SELECT id, user_id, first_name, last_name
    FROM public.musicians
    WHERE organization_id = target_organization_id
      AND status = 'ACTIVO'
      AND birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM birth_date) = v_month
      AND EXTRACT(DAY FROM birth_date) = v_day
  LOOP
    FOR v_member IN
      SELECT user_id FROM public.organization_memberships
      WHERE organization_id = target_organization_id AND approval_status = 'APPROVED'
    LOOP
      IF v_member.user_id = v_bday.user_id THEN
        v_title := '🎂 ¡Feliz cumpleaños!';
        v_msg := '¡Feliz cumpleaños de parte de Proyecto Orquesta!';
      ELSE
        v_title := '🎂 Cumpleaños en la orquesta';
        v_msg := 'Hoy cumple años ' || trim(v_bday.first_name || ' ' || v_bday.last_name) || '.';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_member.user_id
          AND n.type = 'BIRTHDAY'
          AND n.message = v_msg
          AND (n.created_at AT TIME ZONE 'America/Bogota')::date = v_today
      ) THEN
        INSERT INTO public.notifications (organization_id, user_id, type, title, message, link)
        VALUES (target_organization_id, v_member.user_id, 'BIRTHDAY', v_title, v_msg, '/');
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_birthday_notifications(uuid) TO authenticated;

-- 14. REHEARSAL COSTS & CONTRIBUTIONS HARDENING (SCHEMA + RLS + ATOMIC RPC)
ALTER TABLE public.rehearsal_costs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.rehearsal_contributions
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS concept text,
  ADD COLUMN IF NOT EXISTS contribution_date date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.rehearsal_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsal_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rehearsal_costs_select_policy ON public.rehearsal_costs;
DROP POLICY IF EXISTS rehearsal_costs_write_policy ON public.rehearsal_costs;
CREATE POLICY rehearsal_costs_select_policy ON public.rehearsal_costs
  FOR SELECT TO authenticated
  USING (public.is_approved_org_member(organization_id));

CREATE POLICY rehearsal_costs_write_policy ON public.rehearsal_costs
  FOR ALL TO authenticated
  USING (
    public.has_org_permission(organization_id, 'rehearsal_costs.manage')
    OR public.has_org_permission(organization_id, 'rehearsals.manage')
    OR public.has_org_permission(organization_id, 'finances.manage')
  )
  WITH CHECK (
    public.has_org_permission(organization_id, 'rehearsal_costs.manage')
    OR public.has_org_permission(organization_id, 'rehearsals.manage')
    OR public.has_org_permission(organization_id, 'finances.manage')
  );

DROP POLICY IF EXISTS rehearsal_contributions_select_policy ON public.rehearsal_contributions;
DROP POLICY IF EXISTS rehearsal_contributions_write_policy ON public.rehearsal_contributions;
CREATE POLICY rehearsal_contributions_select_policy ON public.rehearsal_contributions
  FOR SELECT TO authenticated
  USING (
    public.has_org_permission(organization_id, 'rehearsal_costs.manage')
    OR public.has_org_permission(organization_id, 'rehearsals.manage')
    OR public.has_org_permission(organization_id, 'finances.manage')
    OR EXISTS (
      SELECT 1 FROM public.musicians m
      WHERE m.id = rehearsal_contributions.musician_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY rehearsal_contributions_write_policy ON public.rehearsal_contributions
  FOR ALL TO authenticated
  USING (
    public.has_org_permission(organization_id, 'rehearsal_costs.manage')
    OR public.has_org_permission(organization_id, 'rehearsals.manage')
    OR public.has_org_permission(organization_id, 'finances.manage')
  )
  WITH CHECK (
    public.has_org_permission(organization_id, 'rehearsal_costs.manage')
    OR public.has_org_permission(organization_id, 'rehearsals.manage')
    OR public.has_org_permission(organization_id, 'finances.manage')
  );

CREATE OR REPLACE FUNCTION public.save_rehearsal_cost_distribution(
  target_organization_id uuid,
  target_rehearsal_id uuid,
  p_total_amount numeric,
  p_description text,
  p_collector_name text,
  p_contributions jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cost_id uuid;
  v_item jsonb;
  v_musician_id uuid;
  v_amount numeric;
  v_notes text;
  v_existing_id uuid;
  v_existing_status text;
  v_desired_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida';
  END IF;

  IF NOT (
    public.has_org_permission(target_organization_id, 'rehearsal_costs.manage')
    OR public.has_org_permission(target_organization_id, 'rehearsals.manage')
    OR public.has_org_permission(target_organization_id, 'finances.manage')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para administrar aportes de ensayo';
  END IF;

  IF COALESCE(p_total_amount, 0) < 0 THEN
    RAISE EXCEPTION 'El costo total no puede ser negativo';
  END IF;

  SELECT id INTO v_cost_id
  FROM public.rehearsal_costs
  WHERE organization_id = target_organization_id AND rehearsal_id = target_rehearsal_id
  LIMIT 1;

  IF v_cost_id IS NULL THEN
    INSERT INTO public.rehearsal_costs (
      organization_id, rehearsal_id, total_amount, description, collector_user_id, collector_name, created_by, updated_at
    )
    VALUES (
      target_organization_id, target_rehearsal_id, p_total_amount, COALESCE(NULLIF(trim(COALESCE(p_description, '')), ''), 'Aporte de ensayo'),
      v_user_id, COALESCE(NULLIF(trim(COALESCE(p_collector_name, '')), ''), 'Director'), v_user_id, now()
    )
    RETURNING id INTO v_cost_id;
  ELSE
    UPDATE public.rehearsal_costs
    SET total_amount = p_total_amount,
        description = COALESCE(NULLIF(trim(COALESCE(p_description, '')), ''), 'Aporte de ensayo'),
        collector_user_id = v_user_id,
        collector_name = COALESCE(NULLIF(trim(COALESCE(p_collector_name, '')), ''), collector_name),
        updated_at = now()
    WHERE id = v_cost_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_contributions, '[]'::jsonb))
  LOOP
    v_musician_id := NULLIF(v_item->>'musician_id', '')::uuid;
    v_amount := COALESCE((v_item->>'amount_due')::numeric, 0);
    v_notes := NULLIF(trim(COALESCE(v_item->>'notes', '')), '');

    IF v_musician_id IS NOT NULL AND v_amount > 0 THEN
      v_desired_ids := array_append(v_desired_ids, v_musician_id);

      SELECT id, status INTO v_existing_id, v_existing_status
      FROM public.rehearsal_contributions
      WHERE rehearsal_cost_id = v_cost_id AND musician_id = v_musician_id
      LIMIT 1;

      IF v_existing_id IS NULL THEN
        INSERT INTO public.rehearsal_contributions (
          organization_id, rehearsal_cost_id, musician_id, amount_due, status, notes, updated_at
        )
        VALUES (
          target_organization_id, v_cost_id, v_musician_id, v_amount, 'PENDIENTE', v_notes, now()
        );
      ELSIF v_existing_status = 'PENDIENTE' THEN
        UPDATE public.rehearsal_contributions
        SET amount_due = v_amount,
            notes = COALESCE(v_notes, notes),
            updated_at = now()
        WHERE id = v_existing_id;
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.rehearsal_contributions
  WHERE rehearsal_cost_id = v_cost_id
    AND status = 'PENDIENTE'
    AND NOT (musician_id = ANY(v_desired_ids));

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, new_value)
  VALUES (
    target_organization_id,
    v_user_id,
    'UPSERT_COST',
    'rehearsal_cost',
    v_cost_id,
    jsonb_build_object('total_amount', p_total_amount, 'contributors', COALESCE(array_length(v_desired_ids, 1), 0))
  );

  RETURN v_cost_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_rehearsal_cost_distribution(uuid, uuid, numeric, text, text, jsonb) TO authenticated;

