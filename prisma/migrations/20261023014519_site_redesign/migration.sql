-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "businessHours" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contactImageUrl" TEXT,
ADD COLUMN     "heroEyebrow" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "legalNotice" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lotImages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "privacyPolicy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "processImageUrl" TEXT,
ADD COLUMN     "socialFacebook" TEXT,
ADD COLUMN     "socialInstagram" TEXT,
ADD COLUMN     "socialLinkedin" TEXT,
ADD COLUMN     "socialYoutube" TEXT;
