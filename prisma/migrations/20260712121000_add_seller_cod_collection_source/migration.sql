-- Keep CodCollectionSource in sync with the delivery/seller collection schema.
ALTER TYPE "CodCollectionSource" ADD VALUE IF NOT EXISTS 'SELLER';
