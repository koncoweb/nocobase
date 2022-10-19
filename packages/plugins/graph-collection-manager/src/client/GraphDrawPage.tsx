import { FullscreenExitOutlined, FullscreenOutlined, MenuOutlined } from '@ant-design/icons';
import { Graph } from '@antv/x6';
import '@antv/x6-react-shape';
import { cx } from '@emotion/css';
import { SchemaOptionsContext } from '@formily/react';
import {
  APIClientProvider,
  CollectionManagerProvider,
  SchemaComponent,
  SchemaComponentOptions,
  useAPIClient,
  useCompile,
} from '@nocobase/client';
import { useFullscreen } from 'ahooks';
import { Button, Input, Layout, Menu, Tooltip, Popover } from 'antd';
import dagre from 'dagre';
import { last, maxBy, minBy } from 'lodash';
import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateActionAndRefreshCM } from './action-hooks';
import Entity from './components/Entity';
import { collection } from './schemas/collection';
import { collectionListClass, graphCollectionContainerClass } from './style';
import { formatData } from './utils';

const LINE_HEIGHT = 40;
const NODE_WIDTH = 250;
let targetGraph;
let targetNode;
let dir = 'TB'; // LR RL TB BT 横排
//计算布局
async function layout(graph, positions: any, createPositions) {
  let graphPositions = [];
  const nodes: any[] = graph.getNodes();
  const edges = graph.getEdges();
  const g: any = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: dir, nodesep: 50, edgesep: 50, rankSep: 50, align: 'DL', controlPoints: true });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((node, i) => {
    const width = NODE_WIDTH;
    const height = node.getPorts().length * 32 + 30;
    g.setNode(node.id, { width, height });
  });
  edges.forEach((edge) => {
    const source = edge.getSource();
    const target = edge.getTarget();
    g.setEdge(source.cell, target.cell);
  });
  dagre.layout(g);
  graph.freeze();
  g.nodes().forEach((id) => {
    const node = graph.getCell(id);
    if (node) {
      const targetPosition =
        (positions &&
          positions.find((v) => {
            return v.collectionName === node.store.data.name;
          })) ||
        {};
      //@ts-ignore
      const calculatedPosition = { x: maxBy(positions, 'x').x + 300, y: minBy(positions, 'y').y };
      node.position(targetPosition.x || calculatedPosition.x, targetPosition.y || calculatedPosition.y);
      if (positions && !positions.find((v) => v.collectionName === node.store.data.name)) {
        // 位置表中没有的表都自动保存
        graphPositions.push({
          collectionName: node.store.data.name,
          x: calculatedPosition.x,
          y: calculatedPosition.y,
        });
      }
    }
  });
  graph.unfreeze();
  if (targetNode) {
    targetNode === 'last'
      ? graph.positionCell(last(nodes), 'top', { padding: 100 })
      : graph.positionCell(targetNode, 'top', { padding: 100 });
  } else {
    graph.centerContent();
  }
  if (graphPositions.length > 0) {
    await createPositions(graphPositions);
    graphPositions = [];
  }
}

function getNodes(nodes, graph) {
  nodes.forEach((item) => {
    graph.addNode(item);
  });
}

function getEdges(edges, graph) {
  edges.forEach((item) => {
    if (item.source && item.target) {
      graph.addEdge({
        ...item,
        connector: {
          name: 'normal',
          zIndex: 10000,
        },
      });
    }
  });
}

const getPopupContainer = () => {
  return document.getElementById('graph_container');
};

const CollapsedContext = createContext<any>({});

export const GraphDrawPage = React.memo(() => {
  const api = useAPIClient();
  const compile = useCompile();
  const { t } = useTranslation('graphPositions');
  const [collectionData, setCollectionData] = useState<any>([]);
  const [collectionList, setCollectionList] = useState<any>([]);
  let options = useContext(SchemaOptionsContext);
  const scope = { ...options?.scope };
  const components = { ...options?.components };

  const useSaveGraphPositionAction = async (data) => {
    await api.resource('graphPositions').create({ values: data });
    await refreshPositions();
  };
  const useUpdatePositionAction = async (position) => {
    await api.resource('graphPositions').update({
      filter: { collectionName: position.collectionName },
      values: { ...position },
    });
    await refreshPositions();
  };
  const refreshPositions = async () => {
    const { data } = await api.resource('graphPositions').list({ paginate: false });
    targetGraph.positions = data.data;
    return Promise.resolve();
  };
  const setTargetNode = (node) => {
    targetNode = node;
  };
  const refreshGM = async () => {
    api
      .resource('collections')
      .list({
        paginate: false,
        appends: ['fields', 'fields.uiSchema'],
        sort: 'sort',
      })
      .then((v) => {
        const { data } = v;
        targetGraph.collections = data.data;
        setCollectionData(data.data);
        setCollectionList(data.data);
        targetGraph && getCollectionData(data.data, targetGraph);
      });
  };
  const initGraphCollections = () => {
    const myGraph = new Graph({
      container: document.getElementById('container')!,
      panning: true,
      moveThreshold: 3,
      height: 1000,
      scroller: {
        enabled: true,
      },
      connecting: {
        anchor: {
          name: 'midSide',
          // args: {
          //   dx: 10,
          // },
        },
      },
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
      },
      snapline: {
        enabled: !0,
      },
      keyboard: {
        enabled: false,
      },
      clipboard: {
        enabled: false,
      },
      interacting: {
        magnetConnectable: false,
      },
      autoResize: document.getElementById('graph_container'),
    });
    targetGraph = myGraph;
    Graph.registerPortLayout(
      'erPortPosition',
      (portsPositionArgs) => {
        return portsPositionArgs.map((_, index) => {
          return {
            position: {
              x: 0,
              y: (index + 1) * LINE_HEIGHT,
            },
            angle: 0,
          };
        });
      },
      true,
    );
    Graph.registerNode(
      'er-rect',
      {
        inherit: 'react-shape',
        component: (node) => (
          <APIClientProvider apiClient={api}>
            <SchemaComponentOptions inherit scope={scope} components={components}>
              <CollectionManagerProvider collections={targetGraph?.collections} refreshCM={refreshGM}>
                <div style={{ height: 'auto' }}>
                  <Entity node={node} setTargetNode={setTargetNode} />
                </div>
              </CollectionManagerProvider>
            </SchemaComponentOptions>
          </APIClientProvider>
        ),
        ports: {
          groups: {
            list: {
              markup: [
                {
                  tagName: 'rect',
                  selector: 'portBody',
                },
              ],
              attrs: {
                portBody: {
                  width: NODE_WIDTH,
                  height: LINE_HEIGHT,
                  strokeWidth: 1,
                  // magnet: true,
                  visibility: 'hidden',
                },
              },
              position: 'erPortPosition',
            },
          },
        },
      },
      true,
    );
    targetGraph.on('edge:mouseover', ({ e, edge }) => {
      e.stopPropagation();
      const targeNode = targetGraph.getCellById(edge.store.data.target.cell);
      const sourceNode = targetGraph.getCellById(edge.store.data.source.cell);
      targeNode.setAttrs({ targetPort: edge.store.data.target.port });
      sourceNode.setAttrs({ sourcePort: edge.store.data.source.port });
    });
    targetGraph.on('edge:mouseout', ({ e, edge }) => {
      e.stopPropagation();
      const targeNode = targetGraph.getCellById(edge.store.data.target.cell);
      const sourceNode = targetGraph.getCellById(edge.store.data.source.cell);
      targeNode.removeAttrs('targetPort');
      sourceNode.removeAttrs('sourcePort');
    });
    targetGraph.on('node:mouseup', ({ e, node }) => {
      const currentPosition = node.position();
      const oldPosition = targetGraph.positions.find((v) => v.collectionName === node.store.data.name);
      e.stopPropagation();
      if (targetNode && targetNode !== 'last') {
        targetNode.removeAttrs();
      }
      if (oldPosition) {
        (oldPosition.x !== currentPosition.x || oldPosition.y !== currentPosition.y) &&
          useUpdatePositionAction({
            collectionName: node.store.data.name,
            ...currentPosition,
          });
      } else {
        useSaveGraphPositionAction({
          collectionName: node.store.data.name,
          ...currentPosition,
        });
      }
    });
  };
  const getCollectionData = (rawData, graph) => {
    const { nodes, edges } = formatData(rawData);
    graph.clearCells();
    getNodes(nodes, graph);
    getEdges(edges, graph);
    layout(graph, targetGraph.positions, useSaveGraphPositionAction);
  };

  useLayoutEffect(() => {
    initGraphCollections();
    return () => {
      targetGraph.off('edge:mouseover');
      targetGraph.off('edge:mouseout');
      targetGraph.on('node:mouseup');
      targetGraph = null;
      targetNode = null;
    };
  }, []);

  useEffect(() => {
    refreshPositions().then(() => {
      refreshGM();
    });
  }, []);

  const handleSearchCollection = (e) => {
    const value = e.target.value.toLowerCase();
    if (value) {
      const targetCollections = collectionData.filter((v) => {
        const collectionTitle = compile(v.title).toLowerCase();
        return collectionTitle.includes(value);
      });
      setCollectionList(targetCollections);
    } else {
      setCollectionList(collectionData);
    }
  };

  const handleSelectCollection = (value) => {
    if (targetNode && targetNode !== 'last') {
      targetNode.removeAttrs();
    }
    targetNode = targetGraph.getCellById(value.key);
    targetGraph.unfreeze();
    // 定位到目标节点
    targetGraph.positionCell(targetNode, 'top', { padding: 100 });
    targetNode.setAttrs({
      boxShadow: '0 1px 2px -2px rgb(0 0 0 / 16%), 0 3px 6px 0 rgb(0 0 0 / 12%), 0 5px 12px 4px rgb(0 0 0 / 9%)',
    });
  };
  return (
    <Layout>
      <div className={cx(graphCollectionContainerClass)}>
        <CollectionManagerProvider collections={targetGraph?.collections} refreshCM={refreshGM}>
          <CollapsedContext.Provider value={{ collectionList, handleSearchCollection }}>
            <div className={cx(collectionListClass)}>
              <SchemaComponent
                schema={{
                  type: 'void',
                  properties: {
                    block1: {
                      type: 'void',
                      'x-collection': 'collections',
                      'x-decorator': 'ResourceActionProvider',
                      'x-decorator-props': {
                        collection,
                        request: {
                          resource: 'collections',
                          action: 'list',
                          params: {
                            pageSize: 50,
                            filter: {
                              inherit: false,
                            },
                            sort: ['sort'],
                            appends: [],
                          },
                        },
                      },
                      properties: {
                        actions: {
                          type: 'void',
                          'x-component': 'ActionBar',
                          'x-component-props': {
                            style: {
                              fontSize: 16,
                            },
                          },
                          properties: {
                            create: {
                              type: 'void',
                              'x-component': 'Action',
                              'x-component-props': {
                                type: 'primary',
                                icon: 'PlusOutlined',
                              },
                              properties: {
                                drawer: {
                                  type: 'void',
                                  title: '{{ t("Create collection") }}',
                                  'x-component': 'Action.Drawer',
                                  'x-component-props': {
                                    getContainer: () => {
                                      return document.getElementById('graph_container');
                                    },
                                  },
                                  'x-decorator': 'Form',
                                  'x-decorator-props': {
                                    useValues: '{{ useCollectionValues }}',
                                  },
                                  properties: {
                                    title: {
                                      'x-component': 'CollectionField',
                                      'x-decorator': 'FormItem',
                                    },
                                    name: {
                                      'x-component': 'CollectionField',
                                      'x-decorator': 'FormItem',
                                      'x-validator': 'uid',
                                    },
                                    footer: {
                                      type: 'void',
                                      'x-component': 'Action.Drawer.Footer',
                                      properties: {
                                        action1: {
                                          title: '{{ t("Cancel") }}',
                                          'x-component': 'Action',
                                          'x-component-props': {
                                            useAction: '{{ cm.useCancelAction }}',
                                          },
                                        },
                                        action2: {
                                          title: '{{ t("Submit") }}',
                                          'x-component': 'Action',
                                          'x-component-props': {
                                            type: 'primary',
                                            useAction: '{{ useCreateActionAndRefreshCM }}',
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fullScreen: {
                              type: 'void',
                              'x-component': 'Action',
                              'x-component-props': {
                                component: (props) => {
                                  const [isFullscreen, { toggleFullscreen }] = useFullscreen(
                                    document.getElementById('graph_container'),
                                  );
                                  return (
                                    <Tooltip title={t('Full Screen')} getPopupContainer={getPopupContainer}>
                                      <Button
                                        onClick={() => {
                                          toggleFullscreen();
                                        }}
                                      >
                                        {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                                      </Button>
                                    </Tooltip>
                                  );
                                },
                                useAction: () => {
                                  return {
                                    run() {},
                                  };
                                },
                              },
                            },
                            collectionList: {
                              type: 'void',
                              'x-component': () => {
                                const { handleSearchCollection, collectionList } = useContext(CollapsedContext);
                                const content = (
                                  <div>
                                    <Input
                                      bordered={false}
                                      placeholder={t('Collection Search')}
                                      onChange={handleSearchCollection}
                                    />
                                    <Menu style={{ maxHeight: '70vh', overflowY: 'auto', border: 'none' }}>
                                      {collectionList.map((v) => {
                                        return (
                                          <Menu.Item key={v.key} onClick={(e) => handleSelectCollection(e)}>
                                            <span>{compile(v.title)}</span>
                                          </Menu.Item>
                                        );
                                      })}
                                    </Menu>
                                  </div>
                                );
                                return (
                                  <Popover
                                    content={content}
                                    placement="bottomRight"
                                    trigger={['click']}
                                    getPopupContainer={getPopupContainer}
                                    destroyTooltipOnHide
                                  >
                                    <Button>
                                      <MenuOutlined />
                                    </Button>
                                  </Popover>
                                );
                              },
                              'x-component-props': {
                                icon: 'MenuOutlined',
                                useAction: () => {
                                  return {
                                    run() {},
                                  };
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                }}
                scope={{
                  useCreateActionAndRefreshCM: () => useCreateActionAndRefreshCM(setTargetNode),
                }}
              />
            </div>
          </CollapsedContext.Provider>
          <div id="container" style={{ width: 'auto', height: 'auto' }}></div>
        </CollectionManagerProvider>
      </div>
    </Layout>
  );
});
