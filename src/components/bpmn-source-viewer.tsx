import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BpmnJsonViewer } from "./bpmn-json-viewer";
import { BpmnXmlViewer } from "./bpmn-xml-viewer";

export function BpmnSourceViewer(){

    return (
        <Tabs defaultValue="account" className="w-full p-2  h-full">
            <TabsList>
                <TabsTrigger value="account">Json</TabsTrigger>
                <TabsTrigger value="password">XML</TabsTrigger>
            </TabsList>
            <TabsContent value="account"><BpmnJsonViewer /></TabsContent>
            <TabsContent value="password"><BpmnXmlViewer /></TabsContent>
        </Tabs>
    );
}