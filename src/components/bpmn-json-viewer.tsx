import JsonView from '@uiw/react-json-view';

import { useTheme } from './providers/theme-provider';
import { useProcess } from './process-provider';

const darkTheme = {
  '--w-rjv-color': '#9cdcfe',
  '--w-rjv-key-number': '#268bd2',
  '--w-rjv-key-string': '#9cdcfe',
  // '--w-rjv-background-color': '#1e1e1e',
  '--w-rjv-line-color': '#36334280',
  '--w-rjv-arrow-color': '#838383',
  '--w-rjv-edit-color': '#9cdcfe',
  '--w-rjv-info-color': '#9c9c9c7a',
  '--w-rjv-update-color': '#9cdcfe',
  '--w-rjv-copied-color': '#9cdcfe',
  '--w-rjv-copied-success-color': '#28a745',
  '--w-rjv-curlybraces-color': '#d4d4d4',
  '--w-rjv-colon-color': '#d4d4d4',
  '--w-rjv-brackets-color': '#d4d4d4',
  '--w-rjv-ellipsis-color': '#cb4b16',
  '--w-rjv-quotes-color': '#9cdcfe',
  '--w-rjv-quotes-string-color': '#ce9178',
  '--w-rjv-type-string-color': '#ce9178',
  '--w-rjv-type-int-color': '#b5cea8',
  '--w-rjv-type-float-color': '#b5cea8',
  '--w-rjv-type-bigint-color': '#b5cea8',
  '--w-rjv-type-boolean-color': '#569cd6',
  '--w-rjv-type-date-color': '#b5cea8',
  '--w-rjv-type-url-color': '#3b89cf',
  '--w-rjv-type-null-color': '#569cd6',
  '--w-rjv-type-nan-color': '#859900',
  '--w-rjv-type-undefined-color': '#569cd6',
};

const lightTheme = {
  '--w-rjv-color': '#001080',
  '--w-rjv-key-number': '#0070c1',
  '--w-rjv-key-string': '#001080',
  // '--w-rjv-background-color': '#ffffff',
  '--w-rjv-line-color': '#d1d5db80',
  '--w-rjv-arrow-color': '#6b7280',
  '--w-rjv-edit-color': '#001080',
  '--w-rjv-info-color': '#6b728080',
  '--w-rjv-update-color': '#001080',
  '--w-rjv-copied-color': '#001080',
  '--w-rjv-copied-success-color': '#16a34a',
  '--w-rjv-curlybraces-color': '#374151',
  '--w-rjv-colon-color': '#374151',
  '--w-rjv-brackets-color': '#374151',
  '--w-rjv-ellipsis-color': '#b45309',
  '--w-rjv-quotes-color': '#001080',
  '--w-rjv-quotes-string-color': '#a31515',
  '--w-rjv-type-string-color': '#a31515',
  '--w-rjv-type-int-color': '#098658',
  '--w-rjv-type-float-color': '#098658',
  '--w-rjv-type-bigint-color': '#098658',
  '--w-rjv-type-boolean-color': '#0000ff',
  '--w-rjv-type-date-color': '#098658',
  '--w-rjv-type-url-color': '#0070c1',
  '--w-rjv-type-null-color': '#0000ff',
  '--w-rjv-type-nan-color': '#6f42c1',
  '--w-rjv-type-undefined-color': '#0000ff',
};

export  function BpmnJsonViewer() {
  const { process } = useProcess();
  const { theme } = useTheme();

  return (
      <JsonView
      value={process}
      className="h-full w-full p-3 bg-transparent"
      style={(theme === 'light' ? lightTheme : darkTheme) as React.CSSProperties}
      />
  );
}