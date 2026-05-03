import { AnchorButton, Icon, Tag } from "@blueprintjs/core";
import React from "react";
import css from "./Osdk.module.css";

const DOCUMENTATION_URL =
  "https://nshackathon.palantirfoundry.com/workspace/developer-console/app/ri.third-party-applications.main.application.0de0c7c1-ff09-4dd5-bcc3-ee09cb116f33/docs/guide/loading-data?language=typescript";

function Osdk(): React.ReactElement {
  return (
    <div className={css.osdk}>
      <div>
        <span>OSDK: </span>
        <Tag minimal={true}>@acdr-live-detection/sdk</Tag>
      </div>
      <AnchorButton
        href={DOCUMENTATION_URL}
        target="_blank"
        rel="noreferrer"
        variant="minimal"
        icon={<Icon icon="book" aria-label="Book icon"></Icon>}
      >
        View documentation
      </AnchorButton>
    </div>
  );
}

export default Osdk;
