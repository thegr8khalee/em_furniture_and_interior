import { Home, Search } from 'lucide-react';
import { FadeIn, PageWrapper } from '../components/animations';
import { Button, Card } from '../components/ui';

const NotFoundPage = () => {
  return (
    <PageWrapper className="min-h-screen bg-base-100">
      <div className="content-shell section-shell flex min-h-screen items-center justify-center px-4">
        <FadeIn>
          <Card className="surface-luxury max-w-xl text-center" padding="px-6 py-12 sm:px-10">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-secondary/30 bg-secondary/10 text-secondary">
              <Search size={22} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">404 Error</p>
            <h1 className="mt-3 font-heading text-5xl font-bold text-primary sm:text-6xl">Page Not Found</h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-base-content/65 sm:text-base">
              The page you're looking for doesn't exist, may have been moved, or is temporarily unavailable.
            </p>
            <div className="mt-8 flex justify-center">
              <Button to="/" leftIcon={Home}>
                Back to Home
              </Button>
            </div>
          </Card>
        </FadeIn>
      </div>
    </PageWrapper>
  );
};

export default NotFoundPage;
