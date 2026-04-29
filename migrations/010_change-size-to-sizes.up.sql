ALTER TABLE products ADD COLUMN sizes TEXT;

UPDATE products SET sizes =
  CASE
    WHEN gender = 'men' THEN '7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12'
    WHEN gender = 'women' THEN '5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10'
    WHEN gender = 'kids' THEN '1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6'
    ELSE '6,7,8,9,10,11,12'
  END;

ALTER TABLE products DROP COLUMN size;
