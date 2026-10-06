import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Table } from 'validation-table';
import 'validation-table-css';
import './style.css';

const query = new URLSearchParams(location.search);
const reserve = query.get('reserve') === 'true';
const initialPage = Number(query.get('initialPage'));
if (![1, 2].includes(initialPage)) throw new Error('Invalid initial page');
const data = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
const columns = [
  { colKey: 'row-select', type: 'multiple' },
  { colKey: 'name', title: 'Name', cell: ({ row }) => <span data-row-id={row.id}>{row.name}</span> },
];
window.validation = {
  provenance: __VALIDATION_PROVENANCE__,
  reserve,
  initialPage,
  ready: false,
  events: [],
  pageEvents: [],
  selected: [],
};
function App() {
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(initialPage);
  const [lastEvent, setLastEvent] = useState(null);
  useEffect(() => {
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        window.validation.ready = true;
        document.getElementById('root').dataset.ready = 'true';
      });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, []);
  useEffect(() => { window.validation.selected = selected; }, [selected]);
  return <main>
    <h1>TDesign Table: page selection regression</h1>
    <p id="source">{__VALIDATION_PROVENANCE__.variant} · {__VALIDATION_PROVENANCE__.sourceSha}</p>
    <p>reserveSelectedRowOnPaginate={String(reserve)}; six rows; two rows per page; page {page}</p>
    <Table data={data} rowKey="id" columns={columns}
      pagination={{ defaultCurrent: initialPage, defaultPageSize: 2, total: 6, showPageSize: false }}
      reserveSelectedRowOnPaginate={reserve}
      selectedRowKeys={selected}
      onPageChange={(pageInfo, rows) => {
        window.validation.pageEvents.push({ current: pageInfo.current, pageSize: pageInfo.pageSize, rowIds: rows.map(row => row.id) });
        setPage(pageInfo.current);
      }}
      onSelectChange={(keys, context) => {
        const event = {
          keys: [...keys],
          selectedRowData: context.selectedRowData.map(row => ({ ...row })),
          selectedRowDataIds: context.selectedRowData.map(row => row.id),
          type: context.type,
          currentRowKey: context.currentRowKey,
        };
        window.validation.events.push(event);
        setLastEvent(event);
        setSelected(keys);
      }} />
    <h2>Controlled selectedRowKeys</h2>
    <pre id="selected">{JSON.stringify(selected)}</pre>
    <h2>Latest onSelectChange payload</h2>
    <pre id="payload">{JSON.stringify(lastEvent, null, 2)}</pre>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
