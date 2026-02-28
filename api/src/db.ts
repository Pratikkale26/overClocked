import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

const connectionString = `${process.env.DATABASE_URL}`

const adapter = new PrismaPg({
    connectionString,
    // Accept self-signed SSL certificates from hosted DB providers (Neon, Supabase, etc.)
    ssl: { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter })

export { prisma }