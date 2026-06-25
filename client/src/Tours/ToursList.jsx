import { Helmet } from 'react-helmet-async';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical, faList, faPlus, faTableCells } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import { DateTime } from 'luxon';

import Api from '../Api';
import { useAuthContext } from '../AuthContext';
import ConfirmModal from '../Components/ConfirmModal';
import Pagination from '../Components/Pagination';
import { useStaticContext } from '../StaticContext';

import TourCard from './TourCard';

function ToursList() {
  const staticContext = useStaticContext();
  const { membership } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const show = searchParams.get('show') ?? 'active';
  const view = searchParams.get('view') ?? 'list';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const [lastPage, setLastPage] = useState(page);
  const [tours, setTours] = useState();
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [copyingTour, setCopyingTour] = useState(null);
  const importFileRef = useRef(null);

  useEffect(() => {
    if (!membership) return;
    let isCancelled = false;
    Api.tours.index(membership.TeamId, show, page).then((response) => {
      if (isCancelled) return;
      setTours(response.data);
      const linkHeader = Api.parseLinkHeader(response);
      let newLastPage = page;
      if (linkHeader?.last) {
        const match = linkHeader.last.match(/page=(\d+)/);
        newLastPage = parseInt(match[1], 10);
      } else if (linkHeader?.next) {
        newLastPage = page + 1;
      }
      setLastPage(newLastPage);
    });
    return () => (isCancelled = true);
  }, [membership, show, page]);

  function setView(newView) {
    if (newView !== view) {
      setSearchParams({ view: newView, page, show });
    }
  }

  function onChangeShow(newShow) {
    if (newShow !== show) {
      setSearchParams({ view, show: newShow });
    }
  }

  async function onImportFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    importFileRef.current.value = '';
    setIsImporting(true);
    setImportError(null);
    try {
      const blob = { filename: file.name, content_type: 'application/zip', byte_size: file.size };
      const assetResponse = await Api.assets.create({ blob });
      const { signed_id, direct_upload } = assetResponse.data;
      await Api.assets.upload(direct_upload.url, direct_upload.headers, file);
      const importResponse = await Api.tours.import(membership.TeamId, signed_id);
      navigate(importResponse.data.id);
    } catch (err) {
      setImportError(err?.response?.data?.message ?? 'Import failed. Please check the file and try again.');
      setIsImporting(false);
    }
  }

  async function onCopy() {
    await Api.tours.copy(copyingTour.id);
    setCopyingTour(null);
    const response = await Api.tours.index(membership.TeamId, show, page);
    setTours(response.data);
  }

  return (
    <>
      <Helmet>
        <title>
          {membership?.Team?.name ?? ''} - Tours - {staticContext?.env?.SITE_TITLE}
        </title>
      </Helmet>
      <main className="container">
        <h1 className="mb-3">{membership?.Team?.name} - Tours</h1>
        <div className="mb-3 d-flex justify-content-between align-items-center">
          <div>
            {membership?.role !== 'VIEWER' && (
              <>
                <Link to="new" className="btn btn-primary">
                  <FontAwesomeIcon icon={faPlus} /> New Tour
                </Link>
                <button className="btn btn-outline-primary ms-2" disabled={isImporting} onClick={() => importFileRef.current.click()}>
                  {isImporting ? 'Importing...' : 'Import Tour'}
                </button>
                <input ref={importFileRef} type="file" accept=".zip" className="d-none" onChange={onImportFileChange} />
              </>
            )}
            {importError && <div className="text-danger mt-2">{importError}</div>}
          </div>
          <div className="d-flex align-items-center">
            <span className="me-2">Show:</span>
            <select className="form-select me-3" value={show} onChange={(event) => onChangeShow(event.target.value)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <span className="me-2">View:</span>
            <div className="btn-group" role="group" aria-label="View options button group">
              <button
                type="button"
                className={classNames('btn btn-outline-secondary', { active: view === 'list' })}
                onClick={() => setView('list')}>
                <FontAwesomeIcon icon={faList} />
              </button>
              <button
                type="button"
                className={classNames('btn btn-outline-secondary', { active: view === 'card' })}
                onClick={() => setView('card')}>
                <FontAwesomeIcon icon={faTableCells} />
              </button>
            </div>
          </div>
        </div>
        {!tours && <div className="spinner-border"></div>}
        {tours && (
          <>
            {view === 'list' && (
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th></th>
                    <th className="w-25">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tours.map((tour) => (
                    <tr key={tour.id} onClick={() => navigate(tour.id)}>
                      <td className="align-middle">{tour.name}</td>
                      <td className="align-middle" onClick={(e) => e.stopPropagation()}>
                        {membership?.role !== 'VIEWER' && (
                          <Dropdown>
                            <Dropdown.Toggle as="button" className="btn btn-sm btn-outline-secondary border-0">
                              <FontAwesomeIcon icon={faEllipsisVertical} />
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                              <Dropdown.Item onClick={() => setCopyingTour(tour)}>Copy</Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown>
                        )}
                      </td>
                      <td className="align-middle">{DateTime.fromISO(tour.createdAt).toLocaleString(DateTime.DATETIME_SHORT)}</td>
                    </tr>
                  ))}
                  {tours.length === 0 && (
                    <tr>
                      <td colSpan={3}>No tours yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            {view === 'card' && (
              <div className="row">
                {tours.map((tour) => (
                  <TourCard key={tour.id} tour={tour} href={tour.id} />
                ))}
                {tours.length === 0 && <div>No tours yet.</div>}
              </div>
            )}
            <Pagination page={page} lastPage={lastPage} otherParams={{ view }} />
          </>
        )}
      </main>
      {copyingTour && (
        <ConfirmModal isShowing={true} title="Copy Tour" onCancel={() => setCopyingTour(null)} onOK={onCopy}>
          Are you sure you want to make a copy of <strong>{copyingTour.name}</strong>?
        </ConfirmModal>
      )}
    </>
  );
}

export default ToursList;
