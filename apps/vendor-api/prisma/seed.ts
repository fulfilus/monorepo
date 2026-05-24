import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (existing) {
    console.log("Admin user already exists — skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash("Admin@Fulfilus2024!", 12);
  const user = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@fulfilus.com",
      passwordHash,
      role: "ADMIN",
    },
    select: { id: true, username: true, email: true, role: true },
  });

  console.log("Created admin user:", user);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
