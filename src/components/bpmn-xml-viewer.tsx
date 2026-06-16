
import XMLViewer from 'react-xml-viewer';
import { useTheme } from './providers/theme-provider';
import { useProcess } from './process-provider';
import { jsonToXml } from '@/lib/json-to-xml';



export function BpmnXmlViewer() {
      const { process } = useProcess();
  const { theme } = useTheme(); 
  const darkTheme = {
    attributeKeyColor: '#9cdcfe',
    attributeValueColor: '#ce9178',
    cdataColor: '#6a9955',
    commentColor: '#6a9955',
    fontFamily: 'monospace',
    separatorColor: '#808080',
    tagColor: '#4ec9b0',
    textColor: '#d4d4d4',
    lineNumberBackground: '#1e1e1e',
    lineNumberColor: '#858585',
  }

  const lightTheme = {
    attributeKeyColor: '#0070c1',
    attributeValueColor: '#a31515',
    cdataColor: '#1D781D',
    commentColor: '#008000',
    fontFamily: 'monospace',
    separatorColor: '#444444',
    tagColor: '#800000',
    textColor: '#333333',
    lineNumberBackground: '#f3f3f3',
    lineNumberColor: '#6e6e6e',
  }

  return (
    <div className="h-full w-full p-3">
      <XMLViewer  xml={jsonToXml(process)} theme={theme === 'dark' ? darkTheme : lightTheme} />
    </div>
  );
}