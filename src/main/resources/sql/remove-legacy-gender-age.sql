
INSERT INTO attributes (name, parent_id, created_date, updated_date)
SELECT 'Giới tính', NULL, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM attributes WHERE parent_id IS NULL AND LOWER(name) = LOWER('Giới tính')
);

INSERT INTO attributes (name, parent_id, created_date, updated_date)
SELECT 'Độ tuổi', NULL, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM attributes WHERE parent_id IS NULL AND LOWER(name) = LOWER('Độ tuổi')
);

SET @gender_root_id := (
    SELECT id FROM attributes
    WHERE parent_id IS NULL AND LOWER(name) = LOWER('Giới tính')
    ORDER BY id LIMIT 1
);

SET @age_root_id := (
    SELECT id FROM attributes
    WHERE parent_id IS NULL AND LOWER(name) = LOWER('Độ tuổi')
    ORDER BY id LIMIT 1
);

INSERT INTO attributes (name, parent_id, created_date, updated_date)
SELECT 'Nam', @gender_root_id, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM attributes WHERE parent_id = @gender_root_id AND LOWER(name) = LOWER('Nam')
);

INSERT INTO attributes (name, parent_id, created_date, updated_date)
SELECT 'Nữ', @gender_root_id, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM attributes WHERE parent_id = @gender_root_id AND LOWER(name) = LOWER('Nữ')
);

INSERT INTO attributes (name, parent_id, created_date, updated_date)
SELECT 'Trẻ em', @age_root_id, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM attributes WHERE parent_id = @age_root_id AND LOWER(name) = LOWER('Trẻ em')
);

INSERT INTO attributes (name, parent_id, created_date, updated_date)
SELECT 'Người lớn', @age_root_id, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM attributes WHERE parent_id = @age_root_id AND LOWER(name) = LOWER('Người lớn')
);

SET @male_id := (
    SELECT id FROM attributes WHERE parent_id = @gender_root_id AND LOWER(name) = LOWER('Nam') ORDER BY id LIMIT 1
);
SET @female_id := (
    SELECT id FROM attributes WHERE parent_id = @gender_root_id AND LOWER(name) = LOWER('Nữ') ORDER BY id LIMIT 1
);
SET @child_id := (
    SELECT id FROM attributes WHERE parent_id = @age_root_id AND LOWER(name) = LOWER('Trẻ em') ORDER BY id LIMIT 1
);
SET @adult_id := (
    SELECT id FROM attributes WHERE parent_id = @age_root_id AND LOWER(name) = LOWER('Người lớn') ORDER BY id LIMIT 1
);

INSERT INTO product_attributes (product_id, attribute_id)
SELECT p.id, @male_id
FROM products p
WHERE p.gender = 'MALE'
  AND NOT EXISTS (
      SELECT 1 FROM product_attributes pa WHERE pa.product_id = p.id AND pa.attribute_id = @male_id
  );

INSERT INTO product_attributes (product_id, attribute_id)
SELECT p.id, @female_id
FROM products p
WHERE p.gender = 'FEMALE'
  AND NOT EXISTS (
      SELECT 1 FROM product_attributes pa WHERE pa.product_id = p.id AND pa.attribute_id = @female_id
  );

INSERT INTO product_attributes (product_id, attribute_id)
SELECT p.id, @child_id
FROM products p
WHERE p.age_group = 'CHILD'
  AND NOT EXISTS (
      SELECT 1 FROM product_attributes pa WHERE pa.product_id = p.id AND pa.attribute_id = @child_id
  );

INSERT INTO product_attributes (product_id, attribute_id)
SELECT p.id, @adult_id
FROM products p
WHERE p.age_group = 'ADULT'
  AND NOT EXISTS (
      SELECT 1 FROM product_attributes pa WHERE pa.product_id = p.id AND pa.attribute_id = @adult_id
  );

SET @drop_gender_sql := IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'gender'
    ),
    'ALTER TABLE products DROP COLUMN gender',
    'SELECT 1'
);
PREPARE drop_gender_stmt FROM @drop_gender_sql;
EXECUTE drop_gender_stmt;
DEALLOCATE PREPARE drop_gender_stmt;

SET @drop_age_sql := IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'age_group'
    ),
    'ALTER TABLE products DROP COLUMN age_group',
    'SELECT 1'
);
PREPARE drop_age_stmt FROM @drop_age_sql;
EXECUTE drop_age_stmt;
DEALLOCATE PREPARE drop_age_stmt;
