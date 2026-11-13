This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Firebase onboarding setup

The doctor and clinic onboarding flow requires Firebase Authentication
(Email/Password), Cloud Firestore, and the `completeDoctorProfile` callable
function. Use Node.js 22 for the Cloud Function runtime.

1. Configure the `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local`.
2. Select your Firebase project with `firebase login` and `firebase use --add`.
3. Install the function dependencies with `npm ci --prefix functions`.
4. Deploy the callable function and Firestore rules:

   ```bash
   firebase deploy --only functions,firestore:rules
   ```

The Firestore rules intentionally deny client writes. Clinic creation and
sequential `CLN-000001` ID allocation happen in the authenticated callable
function. Other application writes will remain denied until their clinic-scoped
rules are implemented.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
