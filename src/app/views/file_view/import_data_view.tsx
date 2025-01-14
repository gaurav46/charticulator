// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
import * as React from "react";
import * as R from "../../resources";
import * as globals from "../../globals";
import { getConfig } from "../../config";
import {
  Dataset,
  deepClone,
  LinkSourceKeyColumn,
  LinkTargetKeyColumn,
  KeyColumn,
} from "../../../core";
import {
  classNames,
  getExtensionFromFileName,
  readFileAsString,
  getFileNameWithoutExtension,
  convertColumns,
} from "../../utils";
import { ButtonRaised } from "../../components/index";
import { SVGImageIcon } from "../../components/icons";
import { TableView } from "../dataset/table_view";
import { PopupView } from "../../controllers";
import { TableType } from "../../../core/dataset";
import { AppStore } from "../../stores";
import { AddMessage, RemoveMessage } from "../../actions/actions";
import { strings } from "../../../strings";

export interface FileUploaderProps {
  onChange: (file: File) => void;
  extensions: string[];
  filename?: string;
}

export interface FileUploaderState {
  filename: string;
  draggingOver: boolean;
}

export class FileUploader extends React.Component<
  FileUploaderProps,
  FileUploaderState
> {
  private inputElement: HTMLInputElement;

  constructor(props: FileUploaderProps) {
    super(props);
    this.state = {
      draggingOver: false,
      filename: props.filename,
    };
  }

  public reset() {
    this.inputElement.value = null;
    this.setState({
      filename: null,
    });
  }

  private onInputChange() {
    if (this.inputElement.files.length == 1) {
      this.setState({
        filename: this.inputElement.files[0].name,
      });
      if (this.props.onChange) {
        this.props.onChange(this.inputElement.files[0]);
      }
    }
  }

  private showOpenFile() {
    this.reset();
    this.inputElement.click();
  }

  private isDataTransferValid(dt: DataTransfer) {
    if (dt && dt.items.length == 1) {
      if (dt.items[0].kind == "file") {
        return true;
      }
    }
    return false;
  }
  private getFileFromDataTransfer(dt: DataTransfer) {
    if (dt && dt.items.length == 1) {
      if (dt.items[0].kind == "file") {
        const file = dt.items[0].getAsFile();
        const ext = getExtensionFromFileName(file.name);
        if (this.props.extensions.indexOf(ext) >= 0) {
          return file;
        } else {
          return null;
        }
      }
    }
    if (dt && dt.files.length == 1) {
      return dt.files[0];
    }
    return null;
  }

  public render() {
    return (
      <div
        className={classNames(
          "charticulator__file-uploader",
          ["is-dragging-over", this.state.draggingOver],
          ["is-active", this.state.filename != null]
        )}
        onClick={() => this.showOpenFile()}
        onDragOver={(e) => {
          e.preventDefault();
          if (this.isDataTransferValid(e.dataTransfer)) {
            this.setState({
              draggingOver: true,
            });
          }
        }}
        onDragLeave={() => {
          this.setState({
            draggingOver: false,
          });
        }}
        onDragExit={() => {
          this.setState({
            draggingOver: false,
          });
        }}
        onDrop={(e) => {
          e.preventDefault();
          this.setState({
            draggingOver: false,
          });
          const file = this.getFileFromDataTransfer(e.dataTransfer);
          if (file != null) {
            this.setState({
              filename: file.name,
            });
            if (this.props.onChange) {
              this.props.onChange(file);
            }
          }
        }}
      >
        <input
          style={{ display: "none" }}
          accept={this.props.extensions.map((x) => "." + x).join(",")}
          ref={(e) => (this.inputElement = e)}
          type="file"
          onChange={() => this.onInputChange()}
        />
        {this.state.filename == null ? (
          <span className="charticulator__file-uploader-prompt">
            <SVGImageIcon url={R.getSVGIcon("toolbar/import")} />
            {strings.fileImport.fileUpload}
          </span>
        ) : (
          <span className="charticulator__file-uploader-filename">
            {this.state.filename}
          </span>
        )}
      </div>
    );
  }
}

export interface ImportDataViewProps {
  onConfirmImport?: (dataset: Dataset.Dataset) => void;
  onCancel?: () => void;
  showCancel?: boolean;
  store: AppStore;
}

export interface ImportDataViewState {
  dataTable: Dataset.Table;
  dataTableOrigin: Dataset.Table;
  linkTable: Dataset.Table;
  linkTableOrigin: Dataset.Table;
}

export class ImportDataView extends React.Component<
  ImportDataViewProps,
  ImportDataViewState
> {
  public state = {
    dataTable: null as Dataset.Table,
    linkTable: null as Dataset.Table,
    dataTableOrigin: null as Dataset.Table,
    linkTableOrigin: null as Dataset.Table,
  };

  constructor(props: ImportDataViewProps) {
    super(props);
    this.props.store.addListener(AppStore.EVENT_GRAPHICS, () =>
      this.forceUpdate()
    );
  }
  private loadFileAsTable(file: File): Promise<Dataset.Table> {
    return readFileAsString(file).then((contents) => {
      const localeFileFormat = this.props.store.getLocaleFileFormat();
      const ext = getExtensionFromFileName(file.name);
      const filename = getFileNameWithoutExtension(file.name);
      const loader = new Dataset.DatasetLoader();
      switch (ext) {
        case "csv": {
          return loader.loadDSVFromContents(
            filename,
            contents,
            localeFileFormat
          );
        }
        case "tsv": {
          return loader.loadDSVFromContents(filename, contents, {
            delimiter: "\t",
            numberFormat: localeFileFormat.numberFormat,
            currency: null,
            group: null,
          });
        }
      }
    });
  }

  public renderTable(
    table: Dataset.Table,
    onTypeChange: (column: string, type: string) => void
  ) {
    return (
      <div className="wide-content">
        <TableView table={table} maxRows={5} onTypeChange={onTypeChange} />
      </div>
    );
  }

  // eslint-disable-next-line
  public render() {
    let sampleDatasetDiv: HTMLDivElement;
    const sampleDatasets = getConfig().SampleDatasets;
    return (
      <div className="charticulator__import-data-view">
        {sampleDatasets != null ? (
          <div ref={(e) => (sampleDatasetDiv = e)}>
            <ButtonRaised
              text={strings.fileImport.loadSample}
              onClick={() => {
                globals.popupController.popupAt(
                  (context) => {
                    return (
                      <PopupView context={context}>
                        <div className="charticulator__sample-dataset-list">
                          {sampleDatasets.map((dataset) => {
                            return (
                              <div
                                className="charticulator__sample-dataset-list-item"
                                key={dataset.name}
                                onClick={() => {
                                  Promise.all(
                                    dataset.tables.map((table, index) => {
                                      const loader = new Dataset.DatasetLoader();
                                      return loader
                                        .loadDSVFromURL(
                                          table.url,
                                          this.props.store.getLocaleFileFormat()
                                        )
                                        .then((r) => {
                                          r.name = table.name;
                                          r.displayName = table.name;
                                          r.type =
                                            index == 0
                                              ? TableType.Main
                                              : TableType.Links; // assumes there are two tables only
                                          return r;
                                        });
                                    })
                                  ).then((tables) => {
                                    context.close();
                                    const ds: Dataset.Dataset = {
                                      name: dataset.name,
                                      tables,
                                    };
                                    this.props.onConfirmImport(ds);
                                  });
                                }}
                              >
                                <div className="el-title">{dataset.name}</div>
                                <div className="el-description">
                                  {dataset.description}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </PopupView>
                    );
                  },
                  { anchor: sampleDatasetDiv }
                );
              }}
            />
          </div>
        ) : null}
        <h2>
          Data
          {this.state.dataTable ? ": " + this.state.dataTable.name : null}
        </h2>
        {this.state.dataTable ? (
          <div className="charticulator__import-data-view-table">
            {this.renderTable(
              this.state.dataTable,
              (column: string, type: string) => {
                const dataColumn = this.state.dataTable.columns.find(
                  (col) => col.name === column
                );
                const dataTableError = convertColumns(
                  this.state.dataTable,
                  dataColumn,
                  this.state.dataTableOrigin,
                  type as Dataset.DataType
                );
                if (dataTableError) {
                  this.props.store.dispatcher.dispatch(
                    new AddMessage("parsingDataError", {
                      text: dataTableError as string,
                    })
                  );
                }
                this.setState({
                  dataTable: this.state.dataTable,
                });
              }
            )}
            <ButtonRaised
              text={strings.fileImport.removeButtonText}
              url={R.getSVGIcon("general/cross")}
              title={strings.fileImport.removeButtonTitle}
              onClick={() => {
                this.setState({
                  dataTable: null,
                  dataTableOrigin: null,
                });
              }}
            />
          </div>
        ) : (
          <FileUploader
            extensions={["csv", "tsv"]}
            onChange={(file) => {
              this.loadFileAsTable(file).then((table) => {
                table.type = TableType.Main;

                this.checkKeyColumn(table, this.state.linkTable);

                this.setState({
                  dataTable: table,
                  dataTableOrigin: deepClone(table),
                });
              });
            }}
          />
        )}
        <h2>
          {strings.fileImport.links}
          {this.state.linkTable ? ": " + this.state.linkTable.name : null}
        </h2>
        {this.state.linkTable ? (
          <div className="charticulator__import-data-view-table">
            {this.renderTable(
              this.state.linkTable,
              (column: string, type: string) => {
                const dataColumn = this.state.linkTable.columns.find(
                  (col) => col.name === column
                );
                const linkTableError = convertColumns(
                  this.state.linkTable,
                  dataColumn,
                  this.state.dataTableOrigin,
                  type as Dataset.DataType
                );

                if (linkTableError) {
                  this.props.store.dispatcher.dispatch(
                    new AddMessage("parsingDataError", {
                      text: linkTableError as string,
                    })
                  );
                }

                this.setState({
                  linkTable: this.state.linkTable,
                  linkTableOrigin: this.state.linkTable,
                });
              }
            )}
            <ButtonRaised
              text={strings.fileImport.removeButtonText}
              url={R.getSVGIcon("general/cross")}
              title={strings.fileImport.removeButtonTitle}
              onClick={() => {
                this.setState({
                  linkTable: null,
                  linkTableOrigin: null,
                });
                this.checkSourceAndTargetColumns(null);
                this.checkKeyColumn(this.state.dataTable, null);
              }}
            />
          </div>
        ) : (
          <FileUploader
            extensions={["csv", "tsv"]}
            onChange={(file) => {
              this.loadFileAsTable(file).then((table) => {
                table.type = TableType.Links;
                this.checkSourceAndTargetColumns(table);
                this.checkKeyColumn(this.state.dataTable, table);
                this.setState({
                  linkTable: table,
                  linkTableOrigin: deepClone(table),
                });
              });
            }}
          />
        )}
        <div className="el-actions">
          <ButtonRaised
            text={strings.fileImport.doneButtonText}
            url={R.getSVGIcon("general/confirm")}
            title={strings.fileImport.doneButtonTitle}
            disabled={
              this.state.dataTable == null ||
              this.props.store.messageState.get("noID") !== undefined ||
              this.props.store.messageState.get("noSourceOrTargetID") !==
                undefined
            }
            onClick={() => {
              if (
                this.state.dataTable != null &&
                this.props.store.messageState.get("noID") === undefined &&
                this.props.store.messageState.get("noSourceOrTargetID") ===
                  undefined
              ) {
                const dataset: Dataset.Dataset = {
                  name: this.state.dataTable.name,
                  tables: [this.state.dataTable],
                };
                if (this.state.linkTable != null) {
                  dataset.tables.push(this.state.linkTable);
                }
                this.props.onConfirmImport(dataset);
              }
            }}
          />
        </div>
        <div className="charticulator__credits">
          <p
            dangerouslySetInnerHTML={{
              __html:
                getConfig().LegalNotices &&
                getConfig().LegalNotices.privacyStatementHTML,
            }}
          />
        </div>
      </div>
    );
  }

  private checkSourceAndTargetColumns(table: Dataset.Table) {
    const countOfKeyColumns =
      table &&
      table.columns.filter(
        (column) =>
          column.name === LinkSourceKeyColumn ||
          column.name === LinkTargetKeyColumn
      ).length;
    if (table && countOfKeyColumns < 2) {
      this.props.store.dispatcher.dispatch(
        new AddMessage("noSourceOrTargetID", {
          text: strings.fileImport.messageNoSourceOrTargetID(
            LinkSourceKeyColumn,
            LinkTargetKeyColumn
          ),
        })
      );
    } else {
      this.props.store.dispatcher.dispatch(
        new RemoveMessage("noSourceOrTargetID")
      );
    }
  }

  private checkKeyColumn(mainTable: Dataset.Table, linksTable: Dataset.Table) {
    const isKeyColumn =
      mainTable &&
      mainTable.columns.find((column) => column.name === KeyColumn);
    if (!isKeyColumn && linksTable) {
      this.props.store.dispatcher.dispatch(
        new AddMessage("noID", {
          text: strings.fileImport.messageNoID(KeyColumn),
        })
      );
    } else {
      this.props.store.dispatcher.dispatch(new RemoveMessage("noID"));
    }
  }
}
