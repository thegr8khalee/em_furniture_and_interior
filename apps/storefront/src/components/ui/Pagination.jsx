import Button from './Button';

const Pagination = ({ currentPage = 1, totalPages = 1, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(0, currentPage - 3),
    Math.min(totalPages, currentPage + 2)
  );

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
      <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => onPageChange?.(currentPage - 1)}>
        Previous
      </Button>
      {pages.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onPageChange?.(page)}
        >
          {page}
        </Button>
      ))}
      <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => onPageChange?.(currentPage + 1)}>
        Next
      </Button>
    </div>
  );
};

export default Pagination;
