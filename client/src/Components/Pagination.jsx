import classNames from 'classnames';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

function Pagination({ page, lastPage, otherParams = {} }) {
  function onClick() {
    window.scrollTo(0, 0);
  }
  let pages = [];
  const firstPage = Math.max(1, page - 5);
  if (firstPage > 1) {
    pages.push(
      <li className="page-item disabled">
        <span className="page-link">&hellip;</span>
      </li>
    );
  }
  const lastVisiblePage = Math.min(lastPage, firstPage + 11);
  for (let i = firstPage; i <= lastVisiblePage; i++) {
    if (i === page) {
      pages.push(
        <li className="page-item active" aria-current="page">
          <span className="page-link">{i}</span>
        </li>
      );
    } else {
      pages.push(
        <li className="page-item">
          <Link to={`?${new URLSearchParams({ ...otherParams, page: i })}`} onClick={onClick} className="page-link">
            {i}
          </Link>
        </li>
      );
    }
  }
  if (lastVisiblePage < lastPage) {
    pages.push(
      <li className="page-item disabled">
        <span className="page-link">&hellip;</span>
      </li>
    );
  }
  return (
    <nav>
      <ul className="pagination justify-content-center">
        <li className={classNames('page-item', { disabled: page === 1 })}>
          {page > 2 && (
            <Link to={`?${new URLSearchParams({ ...otherParams, page: page - 1 })}`} onClick={onClick} className="page-link">
              Prev
            </Link>
          )}
          {page === 2 && (
            <Link to={`?${new URLSearchParams(otherParams)}`} onClick={onClick} className="page-link">
              Prev
            </Link>
          )}
          {page === 1 && <span className="page-link">Prev</span>}
        </li>
        {pages}
        <li className={classNames('page-item', { disabled: page === lastPage })}>
          {page < lastPage && (
            <Link to={`?${new URLSearchParams({ ...otherParams, page: page + 1 })}`} onClick={onClick} className="page-link">
              Next
            </Link>
          )}
          {page === lastPage && <span className="page-link">Next</span>}
        </li>
      </ul>
    </nav>
  );
}

Pagination.propTypes = {
  lastPage: PropTypes.number,
  page: PropTypes.number,
  otherParams: PropTypes.object,
};

export default Pagination;
