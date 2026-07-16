import { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPen, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import TimeCode from 'shared/Components/TimeCode';

import ConfirmModal from '../Components/ConfirmModal';
import ResourceForm from './ResourceForm';

import './ResourcesTable.scss';

function getVariantFile(files, variant, fallbackVariant, variantSuffix = '') {
  let file = files.find((f) => f.variant === `${variant?.code}${variantSuffix}`);
  if (!file?.key) {
    file = files.find((f) => f.variant === `${fallbackVariant?.code}${variantSuffix}`);
  }
  return file;
}

function ResourcesTable({ variant, fallbackVariant, variants, resources, onClick, onChange, onRemove, isEditable }) {
  const [selectedResource, setSelectedResource] = useState();
  const [selectedResourceClone, setSelectedResourceClone] = useState();
  const [isEditing, setEditing] = useState(false);
  const [isAssetShowing, setAssetShowing] = useState(false);
  const [isConfirmRemoveShowing, setConfirmRemoveShowing] = useState(false);

  function onClickEdit(resource) {
    setSelectedResource(resource);
    setSelectedResourceClone(JSON.parse(JSON.stringify(resource)));
    setEditing(true);
  }

  function onChangeTimeCode(name, newValue) {
    selectedResource[name] = newValue;
  }

  function onChangeImageFit(resource, newValue) {
    resource.options.fit = newValue;
    onChange(resource);
  }

  function onTogglePause(resource, newValue) {
    resource.pauseAtEnd = newValue;
    onChange(resource);
  }

  function onClickSubmitEdit() {
    onChange(selectedResource);
    setSelectedResource(undefined);
    setEditing(false);
  }

  function onClickCancelEdit() {
    selectedResource.start = selectedResourceClone.start;
    selectedResource.end = selectedResourceClone.end;
    setSelectedResource(undefined);
    setEditing(false);
  }

  function onClickRemove(resource) {
    setSelectedResource(resource);
    setConfirmRemoveShowing(true);
  }

  function onConfirmRemove(resource) {
    setConfirmRemoveShowing(false);
    onRemove(resource);
  }

  function onSelectAsset(event, resource) {
    event.preventDefault();
    setAssetShowing(true);
    setSelectedResource(resource);
  }

  function onUpdateAsset(resource) {
    setAssetShowing(false);
    selectedResource.Resource = resource;
    onChange(selectedResource);
  }

  return (
    <>
      <table className={classNames('resources-table table table-striped', { 'table-hover': !!onClick })}>
        <thead>
          <tr>
            <th className="resources-table__col-num">#</th>
            <th className="resources-table__col-type">Type</th>
            <th className="resources-table__col-name">Name</th>
            <th className="resources-table__col-timeline">
              <div className="d-flex justify-content-between">
                <span>Timeline</span>
                <span>Options</span>
              </div>
            </th>
            <th className="resources-table__col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {!resources && (
            <tr>
              <td colSpan="5">
                <div className="spinner-border"></div>
              </td>
            </tr>
          )}
          {resources?.length === 0 && (
            <tr>
              <td colSpan="5">No assets yet.</td>
            </tr>
          )}
          {resources?.map((r, i) => (
            <tr key={r.id} onClick={() => onClick?.(r)} className={classNames({ clickable: !!onClick })}>
              <td>{i + 1}</td>
              <td>{r.Resource.type}</td>
              <td>
                <a href="#" onClick={(event) => onSelectAsset(event, r)}>
                  {r.Resource.name}
                </a>
              </td>
              <td>
                <div className="d-flex justify-content-between">
                  <span>
                    <TimeCode
                      onChange={(newValue) => onChangeTimeCode('start', newValue)}
                      isEditing={isEditing && selectedResource === r}
                      seconds={r.start}
                    />{' '}
                    -{' '}
                    {r.Resource.type === 'AUDIO' && (
                      <TimeCode seconds={r.start + getVariantFile(r.Resource.Files, variant, fallbackVariant)?.duration} />
                    )}
                    {r.Resource.type !== 'AUDIO' &&
                      (r.end || (isEditing && selectedResource === r) ? (
                        <TimeCode
                          onChange={(newValue) => onChangeTimeCode('end', newValue)}
                          isEditing={isEditing && selectedResource === r}
                          seconds={r.end}
                        />
                      ) : (
                        'End'
                      ))}
                  </span>
                  {r.Resource.type === 'AUDIO' && !(isEditing && selectedResource === r) && (
                    <span>
                      <div className="form-check">
                        <input
                          onChange={(event) => onTogglePause(r, event.target.checked)}
                          type="checkbox"
                          name="pauseAtEnd"
                          checked={r.pauseAtEnd}
                          className="form-check-input"
                          disabled={!isEditable}
                        />
                        <label className="form-check-label" htmlFor="pauseAtEnd">
                          Pause?
                        </label>
                      </div>
                    </span>
                  )}
                  {r.Resource.type === 'IMAGE' && !(isEditing && selectedResource === r) && (
                    <span>
                      <select
                        className="form-select"
                        onChange={(event) => onChangeImageFit(r, event.target.value)}
                        value={r.options.fit ?? 'cover'}>
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                      </select>
                    </span>
                  )}
                </div>
              </td>
              <td className="resources-table__col-actions">
                {isEditable && (
                  <>
                    {isEditing && selectedResource === r && (
                      <>
                        <button onClick={onClickSubmitEdit} className="btn btn-sm btn-outline-success">
                          <FontAwesomeIcon icon={faCheck} />
                        </button>
                        &nbsp;
                        <button onClick={onClickCancelEdit} className="btn btn-sm btn-outline-secondary">
                          <FontAwesomeIcon icon={faXmark} />
                        </button>
                      </>
                    )}
                    {(!isEditing || selectedResource !== r) && (
                      <>
                        <button
                          onClick={() => onClickEdit(r)}
                          disabled={isEditing && selectedResource !== r}
                          className="btn btn-sm btn-outline-secondary">
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                        &nbsp;
                        <button onClick={() => onClickRemove(r)} className="btn btn-sm btn-outline-danger">
                          <FontAwesomeIcon icon={faTrashCan} />
                        </button>
                      </>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmModal
        isShowing={isConfirmRemoveShowing}
        onCancel={() => setConfirmRemoveShowing(false)}
        onOK={() => onConfirmRemove(selectedResource)}>
        Are you sure you wish to remove <b>{selectedResource?.Resource?.name}</b>?
      </ConfirmModal>
      {isAssetShowing && (
        <Modal show={true} onHide={() => setAssetShowing(false)} size="xl" dialogClassName="resources-modal">
          <Modal.Header closeButton>
            <Modal.Title>Assets</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <ResourceForm
              ResourceId={selectedResource.Resource.id}
              type={selectedResource.Resource.type}
              variants={variants}
              onCancel={() => setAssetShowing(false)}
              onUpdate={onUpdateAsset}
            />
          </Modal.Body>
        </Modal>
      )}
    </>
  );
}

ResourcesTable.propTypes = {
  variant: PropTypes.shape({
    code: PropTypes.string.isRequired,
  }).isRequired,
  fallbackVariant: PropTypes.shape({
    code: PropTypes.string.isRequired,
  }).isRequired,
  variants: PropTypes.array,
  resources: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      start: PropTypes.number.isRequired,
      end: PropTypes.number,
      pauseAtEnd: PropTypes.bool,
      Resource: PropTypes.shape({
        type: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        Files: PropTypes.arrayOf(
          PropTypes.shape({
            variant: PropTypes.string.isRequired,
            duration: PropTypes.number,
          })
        ).isRequired,
      }).isRequired,
    })
  ),
  onClick: PropTypes.func,
  onChange: PropTypes.func,
  onRemove: PropTypes.func,
  isEditable: PropTypes.bool,
};

export default ResourcesTable;
