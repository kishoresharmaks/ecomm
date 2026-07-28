import Link from "next/link";
import { Button } from "@indihub/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center">
      <h2 className="mb-2 text-5xl font-black text-[#1F2933]">404</h2>
      <h3 className="mb-4 text-xl font-bold text-[#667085]">Page Not Found</h3>
      <p className="mb-8 text-base text-[#667085]">The page or resource you are looking for could not be found.</p>
      <Button asChild>
        <Link href="/">Return to Homepage</Link>
      </Button>
    </div>
  );
}
