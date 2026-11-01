-- SQL Migration: Remove areas from the system
-- Run this in your Supabase SQL Editor.
-- Removes the areas table and its reference from handovers.

-- 1. Remove FK constraint and area_id column from handovers
ALTER TABLE handovers DROP CONSTRAINT IF EXISTS handovers_area_id_fkey;
ALTER TABLE handovers DROP COLUMN IF EXISTS area_id;

-- 2. Drop the areas table
DROP TABLE IF EXISTS areas;
