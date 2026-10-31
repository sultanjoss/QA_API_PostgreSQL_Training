INSERT INTO customers (id,name,email,status) VALUES
(1,'Andi Pratama','andi.qa@example.test','ACTIVE'),
(2,'Bunga Maharani','bunga.qa@example.test','ACTIVE'),
(3,'Citra Wijaya','citra.qa@example.test','INACTIVE'),
(4,'Dimas Saputra','dimas.qa@example.test','ACTIVE'),
(5,'Eka Putri','eka.qa@example.test','SUSPENDED');
SELECT setval(pg_get_serial_sequence('customers','id'), 5, true);
INSERT INTO accounts (id,customer_id,account_number,balance,status) VALUES
(1,1,'QA-10000001',200000,'ACTIVE'),
(2,2,'QA-10000002',50000,'ACTIVE'),
(3,4,'QA-10000003',100000,'FROZEN');
SELECT setval(pg_get_serial_sequence('accounts','id'), 3, true);
