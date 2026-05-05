DROP TABLE IF EXISTS nfts;
CREATE TABLE nfts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network VARCHAR(10),
    token_id BIGINT,
    owner_address CHAR(42),
    metadata JSONB DEFAULT '{}',
    last_update_block BIGINT
);
CREATE INDEX idx_nfts_owner ON nfts(owner_address);
CREATE INDEX idx_nfts_network ON nfts(network);

INSERT INTO nfts (network, token_id, owner_address, metadata, last_update_block)
VALUES 
('bsc', 1234, '0xea3516feb8f3e387eec3004330fd30aff615496a', '{"name": "Hero #1234", "attributes": [{"trait_type": "Rarity", "value": "Common"}]}', 38000000),
('bsc', 5678, '0xea3516feb8f3e387eec3004330fd30aff615496a', '{"name": "Hero #5678", "attributes": [{"trait_type": "Rarity", "value": "Super Rare"}]}', 38000000),
('polygon', 9999, '0xea3516feb8f3e387eec3004330fd30aff615496a', '{"name": "Hero #9999", "attributes": [{"trait_type": "Rarity", "value": "Legend"}]}', 56000000),
('polygon', 1010, '0xea3516feb8f3e387eec3004330fd30aff615496a', '{"name": "House #1010", "type": "House"}', 56000001);
