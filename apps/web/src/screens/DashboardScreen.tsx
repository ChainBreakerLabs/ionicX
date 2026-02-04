import BibleSearch from "../components/BibleSearch";
import BibleContent from "../components/BibleContent";
import ScreenShell from "../components/layout/ScreenShell";

export default function Index() {
    return (
        <ScreenShell>
            <div className="flex min-w-0 flex-1 flex-col gap-8">
                <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] items-start">
                    <BibleSearch />
                    <BibleContent />
                </div>
            </div>
        </ScreenShell>
    );
}
