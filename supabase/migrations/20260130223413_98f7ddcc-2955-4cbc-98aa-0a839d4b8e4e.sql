-- =============================================
-- REESTRUCTURACIÓN DE ROLES - ESTRATEGIA ADITIVA
-- =============================================

-- 1. Añadir nuevos valores al enum existente (PostgreSQL permite ADD VALUE)
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'administrador';
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'asesor';

-- 2. Migrar datos de roles antiguos a nuevos
-- Nota: Esta UPDATE se ejecutará en una transacción separada después de los ADD VALUE
-- Por ahora, los usuarios existentes mantienen sus roles antiguos