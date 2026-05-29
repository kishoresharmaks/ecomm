UPDATE checkout_sessions
SET delivery_mode = 'LOCAL_DELIVERY_PARTNER'
WHERE delivery_mode = 'SELLER_SELF_DELIVERY';

UPDATE delivery_details
SET delivery_mode = 'LOCAL_DELIVERY_PARTNER'
WHERE delivery_mode = 'SELLER_SELF_DELIVERY';
