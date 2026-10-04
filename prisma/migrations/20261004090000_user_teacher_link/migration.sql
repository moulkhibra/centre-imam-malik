-- Links an application account to the teacher record it belongs to.
--
-- A teacher who signs in is two rows: the catalogue entry (`Teacher`) and the
-- account (`User`). Nothing tied them together, so linking a teacher to their
-- login meant retyping their name and e-mail into a second record, and a
-- teacher renamed in the catalogue left the account behind.
--
-- `ALTER TABLE ... ADD COLUMN` is used instead of the table rebuild Prisma
-- would generate for this change: SQLite supports it natively, and it leaves the
-- existing rows, their indexes and their foreign keys untouched. The column is
-- nullable, so every account that is not a teacher keeps working unchanged.

ALTER TABLE "User" ADD COLUMN "teacherId" TEXT REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One account per teacher. Two logins on the same person would give that
-- person two audit trails and two sets of group assignments to reconcile.
CREATE UNIQUE INDEX "User_teacherId_key" ON "User"("teacherId");