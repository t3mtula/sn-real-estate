-- Drop deprecated ownerLandlordId/ownerLandlordName fields from bank_accounts.data
-- Junction table landlord_banks is now the single source of truth (M:M)
UPDATE bank_accounts
SET data = (data - 'ownerLandlordId' - 'ownerLandlordName')
WHERE data ? 'ownerLandlordId' OR data ? 'ownerLandlordName';
