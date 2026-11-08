-- Delivery retries reconstruct email from domain records, not retained bodies.
UPDATE "NotificationDelivery" SET "htmlBody" = '', "textBody" = '';
