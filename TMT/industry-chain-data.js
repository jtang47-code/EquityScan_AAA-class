window.TMTIndustryChainData = {
  "nodes": [
    {
      "Node ID": 1,
      "Tier": "Upstream",
      "Node Name": "Raw Materials, Utilities & Basic Components",
      "What this node provides": "Silicon wafers, specialty gases, photoresists, wet chemicals, CMP materials, ABF substrates, copper, glass, fiber, cable materials, connectors, and electrical materials.",
      "Key products / activities": "Silicon wafers; photoresists; specialty gases; process chemicals; ABF substrates; copper/fiber/cable materials; power distribution components",
      "Representative competitors / players": "Shin-Etsu, SUMCO, GlobalWafers, Siltronic, JSR, TOK, Merck, Air Liquide, Linde, Entegris, DuPont, Ibiden, Unimicron, Nan Ya PCB, AT&S, Corning, CommScope, Prysmian, Schneider Electric, Eaton, Siemens",
      "Outflow To IDs": "2, 4, 5, 6, 7, 8, 9",
      "Outflow To Names": "Semicap Equipment; Foundry; Advanced Packaging; Memory & Storage; Networking/Interconnect; Servers & Racks; Data Center Infrastructure",
      "Notes": "The broadest input layer. Supplies both semiconductor manufacturing and the physical data-center buildout."
    },
    {
      "Node ID": 2,
      "Tier": "Upstream",
      "Node Name": "Semiconductor Equipment & Manufacturing Tools",
      "What this node provides": "Lithography, deposition, etch, implant, metrology, inspection, dicing, bonding, packaging tools, and automated test equipment.",
      "Key products / activities": "EUV/DUV lithography; deposition and etch tools; metrology/inspection; dicing/grinding/bonding; ATE",
      "Representative competitors / players": "ASML, Applied Materials, Lam Research, Tokyo Electron, ASM, KLA, Hitachi High-Tech, Disco, BESI, ASMPT, Kulicke & Soffa, Advantest, Teradyne",
      "Outflow To IDs": "4, 5, 6",
      "Outflow To Names": "Foundry; Advanced Packaging; Memory & Storage",
      "Notes": "Enables production capacity for leading-edge logic, HBM, advanced packaging, and specialty chips."
    },
    {
      "Node ID": 3,
      "Tier": "Design",
      "Node Name": "Chip Architecture, IP & EDA",
      "What this node provides": "Chip design, architectures, IP blocks, EDA software, verification, and tape-out preparation for AI accelerators, CPUs, DPUs, NICs, and custom ASICs.",
      "Key products / activities": "GPU/AI accelerator design; CPU design; custom ASIC design; IP licensing; EDA tools",
      "Representative competitors / players": "NVIDIA, AMD, Intel, Broadcom, Marvell, Qualcomm, Arm, Synopsys, Cadence, Siemens EDA, AWS Annapurna, Google, Microsoft, Meta, Tesla, Groq, Cerebras, SambaNova, Tenstorrent",
      "Outflow To IDs": "4, 5",
      "Outflow To Names": "Foundry; Advanced Packaging",
      "Notes": "Creates the design blueprint that is manufactured at foundries and often co-optimized with advanced packaging."
    },
    {
      "Node ID": 4,
      "Tier": "Manufacturing",
      "Node Name": "Wafer Fabrication & Foundry",
      "What this node provides": "Leading-edge and mature-node wafer manufacturing for AI accelerators, CPUs, networking silicon, PMICs, and supporting components.",
      "Key products / activities": "Advanced logic wafers; networking silicon wafers; mixed-signal and specialty wafers",
      "Representative competitors / players": "TSMC, Samsung Foundry, Intel Foundry, GlobalFoundries, UMC, SMIC, PSMC, VIS",
      "Outflow To IDs": "5",
      "Outflow To Names": "Advanced Packaging, OSAT & Test",
      "Notes": "Converts chip designs into physical wafers. Leading-edge AI economics are heavily concentrated here."
    },
    {
      "Node ID": 5,
      "Tier": "Manufacturing",
      "Node Name": "Advanced Packaging, OSAT & Test",
      "What this node provides": "2.5D/3D packaging, chiplet integration, HBM attachment, module assembly, final assembly, and product test.",
      "Key products / activities": "CoWoS/SoIC/Foveros-class packaging; HBM integration; OSAT assembly and test",
      "Representative competitors / players": "TSMC, Samsung, Intel, ASE, Amkor, SPIL, JCET, PTI, ChipMOS, Ibiden, Unimicron, Nan Ya PCB, Shinko",
      "Outflow To IDs": "7, 8, 10",
      "Outflow To Names": "Networking/Interconnect; Servers & Racks; Cloud/Compute Owners",
      "Notes": "A critical AI bottleneck because advanced accelerators increasingly require logic plus multiple HBM stacks in one package."
    },
    {
      "Node ID": 6,
      "Tier": "Manufacturing",
      "Node Name": "Memory & Storage",
      "What this node provides": "HBM, DRAM, NAND, SSDs, memory modules, and enterprise storage components used across AI servers and storage systems.",
      "Key products / activities": "HBM; DRAM; NAND; enterprise SSDs; memory modules",
      "Representative competitors / players": "SK hynix, Samsung, Micron, Kioxia, Solidigm, Western Digital",
      "Outflow To IDs": "5, 7, 8, 10",
      "Outflow To Names": "Advanced Packaging; Networking/Interconnect; Servers & Racks; Cloud/Compute Owners",
      "Notes": "HBM is one of the most strategic AI bottlenecks; SSD and storage media also scale with training and inference workloads."
    },
    {
      "Node ID": 7,
      "Tier": "Systems",
      "Node Name": "Networking, Interconnect, Optics & Data Movement",
      "What this node provides": "Scale-up/scale-out networking, switches, NICs, DPUs, transceivers, co-packaged optics, high-speed connectors, cable assemblies, and fiber links.",
      "Key products / activities": "Switch ASICs; NICs/DPUs; InfiniBand/Ethernet; optical modules; connectors; cable assemblies; fiber interconnect",
      "Representative competitors / players": "NVIDIA, Broadcom, Marvell, Intel, Arista, Cisco, Juniper, Coherent, Lumentum, InnoLight, Eoptolink, Source Photonics, Ciena, Amphenol, TE Connectivity, Molex, Luxshare, Rosenberger, CommScope",
      "Outflow To IDs": "8, 9, 10",
      "Outflow To Names": "Servers & Racks; Data Center Infrastructure; Cloud/Compute Owners",
      "Notes": "Amphenol sits mainly here as an interconnect/connectivity supplier, with overlap into rack and facility power/connectivity components."
    },
    {
      "Node ID": 8,
      "Tier": "Systems",
      "Node Name": "AI Servers, Racks & System Integration",
      "What this node provides": "Complete accelerator servers, rack-scale systems, storage integration, and cluster deployment for training and inference.",
      "Key products / activities": "GPU/ASIC servers; rack-scale AI systems; storage systems; cluster integration",
      "Representative competitors / players": "Dell, HPE, Lenovo, Supermicro, Cisco, Quanta, Wiwynn, Foxconn, Inventec, Wistron, Compal, Inspur, xFusion, H3C, NetApp, Pure Storage, DDN, VAST Data",
      "Outflow To IDs": "9, 10, 12",
      "Outflow To Names": "Data Center Infrastructure; Cloud/Compute Owners; Applications & End Users",
      "Notes": "Converts packaged chips, memory, networking, and storage into deployable clusters or on-prem systems."
    },
    {
      "Node ID": 9,
      "Tier": "Infrastructure",
      "Node Name": "Data Center Physical Infrastructure (Power, Cooling, Buildings)",
      "What this node provides": "UPS, switchgear, transformers, busways, racks, chillers, liquid cooling, CDUs, modular builds, and site deployment services.",
      "Key products / activities": "Power distribution systems; liquid cooling; racks/enclosures; modular data-center infrastructure",
      "Representative competitors / players": "Schneider Electric, Eaton, Siemens, GE Vernova, Mitsubishi Electric, Vertiv, Trane, Johnson Controls, CoolIT, Boyd, nVent, Legrand, Bechtel, Fluor, AECOM",
      "Outflow To IDs": "10, 12",
      "Outflow To Names": "Cloud/Compute Owners; Applications & End Users",
      "Notes": "Makes high-density AI clusters physically operable; often a gating factor because of power delivery and thermal limits."
    },
    {
      "Node ID": 10,
      "Tier": "Compute Ownership & Distribution",
      "Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "What this node provides": "Large-scale training and inference capacity, managed AI services, rented GPU clusters, and internally owned AI infrastructure.",
      "Key products / activities": "Cloud AI compute; managed AI services; sovereign/telco AI compute; GPU cloud capacity",
      "Representative competitors / players": "AWS, Microsoft Azure, Google Cloud, Oracle Cloud, Alibaba Cloud, Tencent Cloud, CoreWeave, Lambda, Crusoe, Nebius, Vultr",
      "Outflow To IDs": "11, 12",
      "Outflow To Names": "Foundation Models & AI Platforms; Applications & End Users",
      "Notes": "This layer aggregates infrastructure and sells or allocates compute to model builders and enterprise users."
    },
    {
      "Node ID": 11,
      "Tier": "Software",
      "Node Name": "Foundation Models & AI Platform Layer",
      "What this node provides": "Base models, APIs, model hosting, fine-tuning, orchestration, developer tooling, and enterprise AI software platforms.",
      "Key products / activities": "Model APIs; model hosting; orchestration; MLOps/dev tools; enterprise data/AI platforms",
      "Representative competitors / players": "OpenAI, Anthropic, Google DeepMind, Meta, xAI, Mistral, Cohere, Databricks, Snowflake, Microsoft, Google, AWS, Oracle, Hugging Face, Weights & Biases, LangChain, Anyscale, Red Hat",
      "Outflow To IDs": "12",
      "Outflow To Names": "Applications & End Users",
      "Notes": "Turns raw compute into usable AI products, APIs, and enterprise deployment frameworks."
    },
    {
      "Node ID": 12,
      "Tier": "Demand",
      "Node Name": "Applications & End Users",
      "What this node provides": "AI applications and the final demand layer across consumers, enterprises, governments, healthcare, manufacturing, telecom, autos, and research.",
      "Key products / activities": "Copilots; search; CRM/workflow AI; cybersecurity AI; creative tools; industrial automation; robotics; consumer AI devices",
      "Representative competitors / players": "Microsoft, Google, Zoom, Notion, Salesforce, ServiceNow, SAP, Oracle, Adobe, Canva, Runway, Palo Alto Networks, CrowdStrike, SentinelOne, Tesla, ABB, Siemens, Rockwell, Fanuc, Apple, Samsung, Qualcomm, MediaTek",
      "Outflow To IDs": "None (terminal demand in the forward supply chain)",
      "Outflow To Names": null,
      "Notes": "Terminal demand layer. In practice, usage data and demand feedback can loop back upstream, but the forward industrial flow ends here."
    }
  ],
  "nodeSubsegments": [
    {
      "Node ID": 1,
      "Node Name": "Raw Materials, Utilities & Basic Components",
      "Subsegment": "Silicon wafers",
      "Main competitors / representative players": "Shin-Etsu, SUMCO, GlobalWafers, Siltronic",
      "Why it matters in AI": "Critical inputs for fabs, packaging, cables, and data-center buildout.",
      "Amphenol note": null
    },
    {
      "Node ID": 1,
      "Node Name": "Raw Materials, Utilities & Basic Components",
      "Subsegment": "Photoresists & lithography chemicals",
      "Main competitors / representative players": "JSR, TOK, Shin-Etsu Chemical, Merck",
      "Why it matters in AI": "Critical inputs for fabs, packaging, cables, and data-center buildout.",
      "Amphenol note": null
    },
    {
      "Node ID": 1,
      "Node Name": "Raw Materials, Utilities & Basic Components",
      "Subsegment": "Specialty gases / process chemicals / contamination control",
      "Main competitors / representative players": "Air Liquide, Linde, Entegris, DuPont",
      "Why it matters in AI": "Critical inputs for fabs, packaging, cables, and data-center buildout.",
      "Amphenol note": null
    },
    {
      "Node ID": 1,
      "Node Name": "Raw Materials, Utilities & Basic Components",
      "Subsegment": "ABF & advanced substrates",
      "Main competitors / representative players": "Ibiden, Unimicron, Nan Ya PCB, AT&S, Shinko",
      "Why it matters in AI": "Critical inputs for fabs, packaging, cables, and data-center buildout.",
      "Amphenol note": null
    },
    {
      "Node ID": 1,
      "Node Name": "Raw Materials, Utilities & Basic Components",
      "Subsegment": "Copper / fiber / cable materials",
      "Main competitors / representative players": "Corning, CommScope, Prysmian, Furukawa",
      "Why it matters in AI": "Critical inputs for fabs, packaging, cables, and data-center buildout.",
      "Amphenol note": null
    },
    {
      "Node ID": 1,
      "Node Name": "Raw Materials, Utilities & Basic Components",
      "Subsegment": "Power distribution components",
      "Main competitors / representative players": "Schneider Electric, Eaton, Siemens, GE Vernova, Mitsubishi Electric",
      "Why it matters in AI": "Critical inputs for fabs, packaging, cables, and data-center buildout.",
      "Amphenol note": null
    },
    {
      "Node ID": 2,
      "Node Name": "Semiconductor Equipment & Manufacturing Tools",
      "Subsegment": "Lithography",
      "Main competitors / representative players": "ASML",
      "Why it matters in AI": "Determines how much leading-edge logic, HBM, and packaging capacity can be built.",
      "Amphenol note": null
    },
    {
      "Node ID": 2,
      "Node Name": "Semiconductor Equipment & Manufacturing Tools",
      "Subsegment": "Deposition / etch / implant",
      "Main competitors / representative players": "Applied Materials, Lam Research, Tokyo Electron, ASM",
      "Why it matters in AI": "Determines how much leading-edge logic, HBM, and packaging capacity can be built.",
      "Amphenol note": null
    },
    {
      "Node ID": 2,
      "Node Name": "Semiconductor Equipment & Manufacturing Tools",
      "Subsegment": "Inspection / metrology",
      "Main competitors / representative players": "KLA, Hitachi High-Tech",
      "Why it matters in AI": "Determines how much leading-edge logic, HBM, and packaging capacity can be built.",
      "Amphenol note": null
    },
    {
      "Node ID": 2,
      "Node Name": "Semiconductor Equipment & Manufacturing Tools",
      "Subsegment": "Dicing / grinding / packaging tools",
      "Main competitors / representative players": "Disco, BESI, ASMPT, Kulicke & Soffa",
      "Why it matters in AI": "Determines how much leading-edge logic, HBM, and packaging capacity can be built.",
      "Amphenol note": null
    },
    {
      "Node ID": 2,
      "Node Name": "Semiconductor Equipment & Manufacturing Tools",
      "Subsegment": "Automated test equipment (ATE)",
      "Main competitors / representative players": "Advantest, Teradyne",
      "Why it matters in AI": "Determines how much leading-edge logic, HBM, and packaging capacity can be built.",
      "Amphenol note": null
    },
    {
      "Node ID": 3,
      "Node Name": "Chip Architecture, IP & EDA",
      "Subsegment": "AI accelerator designers",
      "Main competitors / representative players": "NVIDIA, AMD, Intel, Broadcom, Marvell, Qualcomm",
      "Why it matters in AI": "Defines chip performance, economics, and software compatibility.",
      "Amphenol note": null
    },
    {
      "Node ID": 3,
      "Node Name": "Chip Architecture, IP & EDA",
      "Subsegment": "Cloud custom silicon",
      "Main competitors / representative players": "AWS Annapurna, Google, Microsoft, Meta, Tesla",
      "Why it matters in AI": "Defines chip performance, economics, and software compatibility.",
      "Amphenol note": null
    },
    {
      "Node ID": 3,
      "Node Name": "Chip Architecture, IP & EDA",
      "Subsegment": "AI-first chip startups",
      "Main competitors / representative players": "Groq, Cerebras, SambaNova, Tenstorrent",
      "Why it matters in AI": "Defines chip performance, economics, and software compatibility.",
      "Amphenol note": null
    },
    {
      "Node ID": 3,
      "Node Name": "Chip Architecture, IP & EDA",
      "Subsegment": "CPU architecture / IP",
      "Main competitors / representative players": "Arm, Intel, AMD",
      "Why it matters in AI": "Defines chip performance, economics, and software compatibility.",
      "Amphenol note": null
    },
    {
      "Node ID": 3,
      "Node Name": "Chip Architecture, IP & EDA",
      "Subsegment": "EDA",
      "Main competitors / representative players": "Synopsys, Cadence, Siemens EDA",
      "Why it matters in AI": "Defines chip performance, economics, and software compatibility.",
      "Amphenol note": null
    },
    {
      "Node ID": 4,
      "Node Name": "Wafer Fabrication & Foundry",
      "Subsegment": "Leading-edge foundry",
      "Main competitors / representative players": "TSMC, Samsung Foundry, Intel Foundry",
      "Why it matters in AI": "Converts designs into wafers; leading-edge capacity remains concentrated.",
      "Amphenol note": null
    },
    {
      "Node ID": 4,
      "Node Name": "Wafer Fabrication & Foundry",
      "Subsegment": "Mature-node / specialty foundry",
      "Main competitors / representative players": "GlobalFoundries, UMC, SMIC, PSMC, VIS",
      "Why it matters in AI": "Converts designs into wafers; leading-edge capacity remains concentrated.",
      "Amphenol note": null
    },
    {
      "Node ID": 5,
      "Node Name": "Advanced Packaging, OSAT & Test",
      "Subsegment": "Advanced packaging platforms",
      "Main competitors / representative players": "TSMC CoWoS/SoIC, Samsung X-Cube, Intel Foveros/EMIB",
      "Why it matters in AI": "Key bottleneck for logic + HBM integration and chiplet assembly.",
      "Amphenol note": null
    },
    {
      "Node ID": 5,
      "Node Name": "Advanced Packaging, OSAT & Test",
      "Subsegment": "OSAT",
      "Main competitors / representative players": "ASE, Amkor, SPIL, JCET, PTI, ChipMOS",
      "Why it matters in AI": "Key bottleneck for logic + HBM integration and chiplet assembly.",
      "Amphenol note": null
    },
    {
      "Node ID": 5,
      "Node Name": "Advanced Packaging, OSAT & Test",
      "Subsegment": "Substrates / package ecosystem",
      "Main competitors / representative players": "Ibiden, Unimicron, Nan Ya PCB, Shinko",
      "Why it matters in AI": "Key bottleneck for logic + HBM integration and chiplet assembly.",
      "Amphenol note": null
    },
    {
      "Node ID": 6,
      "Node Name": "Memory & Storage",
      "Subsegment": "HBM / DRAM",
      "Main competitors / representative players": "SK hynix, Samsung, Micron",
      "Why it matters in AI": "HBM and enterprise storage are essential to training and inference throughput.",
      "Amphenol note": null
    },
    {
      "Node ID": 6,
      "Node Name": "Memory & Storage",
      "Subsegment": "NAND / enterprise SSD",
      "Main competitors / representative players": "Samsung, Micron, Kioxia, Solidigm, Western Digital",
      "Why it matters in AI": "HBM and enterprise storage are essential to training and inference throughput.",
      "Amphenol note": null
    },
    {
      "Node ID": 7,
      "Node Name": "Networking, Interconnect, Optics & Data Movement",
      "Subsegment": "Switch ASIC / NIC / DPU silicon",
      "Main competitors / representative players": "NVIDIA, Broadcom, Marvell, Intel",
      "Why it matters in AI": "Data movement is a first-order bottleneck in AI cluster scaling.",
      "Amphenol note": null
    },
    {
      "Node ID": 7,
      "Node Name": "Networking, Interconnect, Optics & Data Movement",
      "Subsegment": "Switching and routing systems",
      "Main competitors / representative players": "Arista, Cisco, Juniper, NVIDIA, Broadcom-based OEMs",
      "Why it matters in AI": "Data movement is a first-order bottleneck in AI cluster scaling.",
      "Amphenol note": null
    },
    {
      "Node ID": 7,
      "Node Name": "Networking, Interconnect, Optics & Data Movement",
      "Subsegment": "High-speed connectors / cable assemblies",
      "Main competitors / representative players": "Amphenol, TE Connectivity, Molex, Luxshare, Rosenberger, CommScope",
      "Why it matters in AI": "Data movement is a first-order bottleneck in AI cluster scaling.",
      "Amphenol note": "Amphenol is best placed here."
    },
    {
      "Node ID": 7,
      "Node Name": "Networking, Interconnect, Optics & Data Movement",
      "Subsegment": "Optics / transceivers / photonics",
      "Main competitors / representative players": "Coherent, Lumentum, InnoLight, Eoptolink, Accelink, Source Photonics, Ciena",
      "Why it matters in AI": "Data movement is a first-order bottleneck in AI cluster scaling.",
      "Amphenol note": null
    },
    {
      "Node ID": 8,
      "Node Name": "AI Servers, Racks & System Integration",
      "Subsegment": "OEM AI servers",
      "Main competitors / representative players": "Dell, HPE, Lenovo, Supermicro, Cisco",
      "Why it matters in AI": "Turns semis + memory + networking into deployable AI systems.",
      "Amphenol note": "Amphenol has overlap here via rack/facility connectivity and some power paths."
    },
    {
      "Node ID": 8,
      "Node Name": "AI Servers, Racks & System Integration",
      "Subsegment": "ODM AI servers / racks",
      "Main competitors / representative players": "Quanta, Wiwynn, Foxconn, Inventec, Wistron, Compal",
      "Why it matters in AI": "Turns semis + memory + networking into deployable AI systems.",
      "Amphenol note": "Amphenol has overlap here via rack/facility connectivity and some power paths."
    },
    {
      "Node ID": 8,
      "Node Name": "AI Servers, Racks & System Integration",
      "Subsegment": "AI storage partners",
      "Main competitors / representative players": "NetApp, Pure Storage, DDN, VAST Data",
      "Why it matters in AI": "Turns semis + memory + networking into deployable AI systems.",
      "Amphenol note": "Amphenol has overlap here via rack/facility connectivity and some power paths."
    },
    {
      "Node ID": 9,
      "Node Name": "Data Center Physical Infrastructure (Power, Cooling, Buildings)",
      "Subsegment": "Power & electrical systems",
      "Main competitors / representative players": "Schneider Electric, Eaton, Siemens, GE Vernova, Mitsubishi Electric",
      "Why it matters in AI": "Power and cooling constraints increasingly limit AI deployment speed.",
      "Amphenol note": "Amphenol has overlap here via rack/facility connectivity and some power paths."
    },
    {
      "Node ID": 9,
      "Node Name": "Data Center Physical Infrastructure (Power, Cooling, Buildings)",
      "Subsegment": "Cooling / thermal management",
      "Main competitors / representative players": "Vertiv, Schneider Electric, Trane, Johnson Controls, CoolIT, Boyd, nVent",
      "Why it matters in AI": "Power and cooling constraints increasingly limit AI deployment speed.",
      "Amphenol note": "Amphenol has overlap here via rack/facility connectivity and some power paths."
    },
    {
      "Node ID": 9,
      "Node Name": "Data Center Physical Infrastructure (Power, Cooling, Buildings)",
      "Subsegment": "Racks / enclosures",
      "Main competitors / representative players": "Vertiv, Schneider Electric, Legrand, nVent",
      "Why it matters in AI": "Power and cooling constraints increasingly limit AI deployment speed.",
      "Amphenol note": "Amphenol has overlap here via rack/facility connectivity and some power paths."
    },
    {
      "Node ID": 9,
      "Node Name": "Data Center Physical Infrastructure (Power, Cooling, Buildings)",
      "Subsegment": "Construction / modular deployment",
      "Main competitors / representative players": "Bechtel, Fluor, AECOM",
      "Why it matters in AI": "Power and cooling constraints increasingly limit AI deployment speed.",
      "Amphenol note": "Amphenol has overlap here via rack/facility connectivity and some power paths."
    },
    {
      "Node ID": 10,
      "Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "Subsegment": "Hyperscalers",
      "Main competitors / representative players": "AWS, Microsoft Azure, Google Cloud, Oracle Cloud, Alibaba Cloud, Tencent Cloud",
      "Why it matters in AI": "Owns or rents out large-scale AI compute and determines distribution economics.",
      "Amphenol note": null
    },
    {
      "Node ID": 10,
      "Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "Subsegment": "Neo-clouds / GPU clouds",
      "Main competitors / representative players": "CoreWeave, Lambda, Crusoe, Nebius, Vultr",
      "Why it matters in AI": "Owns or rents out large-scale AI compute and determines distribution economics.",
      "Amphenol note": null
    },
    {
      "Node ID": 10,
      "Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "Subsegment": "Sovereign / telco-backed compute",
      "Main competitors / representative players": "National AI clouds, telecom-backed compute platforms, state-backed AI infrastructure players",
      "Why it matters in AI": "Owns or rents out large-scale AI compute and determines distribution economics.",
      "Amphenol note": null
    },
    {
      "Node ID": 11,
      "Node Name": "Foundation Models & AI Platform Layer",
      "Subsegment": "Foundation model / API platforms",
      "Main competitors / representative players": "OpenAI, Anthropic, Google DeepMind, Meta, xAI, Mistral, Cohere",
      "Why it matters in AI": "Packages compute into APIs, platforms, and usable enterprise software.",
      "Amphenol note": null
    },
    {
      "Node ID": 11,
      "Node Name": "Foundation Models & AI Platform Layer",
      "Subsegment": "Enterprise AI platforms",
      "Main competitors / representative players": "Databricks, Snowflake, Microsoft, Google, AWS, Oracle",
      "Why it matters in AI": "Packages compute into APIs, platforms, and usable enterprise software.",
      "Amphenol note": null
    },
    {
      "Node ID": 11,
      "Node Name": "Foundation Models & AI Platform Layer",
      "Subsegment": "MLOps / developer tools",
      "Main competitors / representative players": "Hugging Face, Weights & Biases, LangChain, Anyscale, Red Hat",
      "Why it matters in AI": "Packages compute into APIs, platforms, and usable enterprise software.",
      "Amphenol note": null
    },
    {
      "Node ID": 12,
      "Node Name": "Applications & End Users",
      "Subsegment": "Productivity / office AI",
      "Main competitors / representative players": "Microsoft, Google, Zoom, Notion",
      "Why it matters in AI": "Captures the final application demand across sectors.",
      "Amphenol note": null
    },
    {
      "Node ID": 12,
      "Node Name": "Applications & End Users",
      "Subsegment": "CRM / enterprise workflow AI",
      "Main competitors / representative players": "Salesforce, ServiceNow, SAP, Oracle",
      "Why it matters in AI": "Captures the final application demand across sectors.",
      "Amphenol note": null
    },
    {
      "Node ID": 12,
      "Node Name": "Applications & End Users",
      "Subsegment": "Creative / media AI",
      "Main competitors / representative players": "Adobe, Canva, Runway",
      "Why it matters in AI": "Captures the final application demand across sectors.",
      "Amphenol note": null
    },
    {
      "Node ID": 12,
      "Node Name": "Applications & End Users",
      "Subsegment": "Cybersecurity AI",
      "Main competitors / representative players": "Palo Alto Networks, CrowdStrike, SentinelOne, Microsoft",
      "Why it matters in AI": "Captures the final application demand across sectors.",
      "Amphenol note": null
    },
    {
      "Node ID": 12,
      "Node Name": "Applications & End Users",
      "Subsegment": "Industrial / robotics / autonomy",
      "Main competitors / representative players": "Tesla, ABB, Siemens, Rockwell, Fanuc, UiPath",
      "Why it matters in AI": "Captures the final application demand across sectors.",
      "Amphenol note": null
    },
    {
      "Node ID": 12,
      "Node Name": "Applications & End Users",
      "Subsegment": "Consumer / edge AI devices",
      "Main competitors / representative players": "Apple, Samsung, Xiaomi, Lenovo, Dell, HP, Qualcomm, MediaTek",
      "Why it matters in AI": "Captures the final application demand across sectors.",
      "Amphenol note": null
    }
  ],
  "flows": [
    {
      "From Node ID": 1,
      "From Node Name": "Raw Materials, Utilities & Basic Components",
      "To Node ID": 2,
      "To Node Name": "Semicap Equipment & Manufacturing Tools",
      "What flows downstream": "Metals, chemicals, ceramics, optics materials, electronic components",
      "Why this link exists": "Upstream inputs are needed to build manufacturing tools and subsystems.",
      "Direction": "1 -> 2"
    },
    {
      "From Node ID": 1,
      "From Node Name": "Raw Materials, Utilities & Basic Components",
      "To Node ID": 4,
      "To Node Name": "Wafer Fabrication & Foundry",
      "What flows downstream": "Silicon wafers, photoresists, gases, chemicals, slurry",
      "Why this link exists": "Direct process inputs for wafer manufacturing.",
      "Direction": "1 -> 4"
    },
    {
      "From Node ID": 1,
      "From Node Name": "Raw Materials, Utilities & Basic Components",
      "To Node ID": 5,
      "To Node Name": "Advanced Packaging, OSAT & Test",
      "What flows downstream": "Substrates, chemicals, underfill, solder materials",
      "Why this link exists": "Packaging and final assembly require distinct materials and substrates.",
      "Direction": "1 -> 5"
    },
    {
      "From Node ID": 1,
      "From Node Name": "Raw Materials, Utilities & Basic Components",
      "To Node ID": 6,
      "To Node Name": "Memory & Storage",
      "What flows downstream": "Wafer, chemicals, specialty materials",
      "Why this link exists": "Memory fabs and SSD manufacturing consume similar materials stacks.",
      "Direction": "1 -> 6"
    },
    {
      "From Node ID": 1,
      "From Node Name": "Raw Materials, Utilities & Basic Components",
      "To Node ID": 7,
      "To Node Name": "Networking, Interconnect, Optics & Data Movement",
      "What flows downstream": "Fiber, copper, cable materials, connector parts",
      "Why this link exists": "High-speed network gear depends on physical interconnect materials.",
      "Direction": "1 -> 7"
    },
    {
      "From Node ID": 1,
      "From Node Name": "Raw Materials, Utilities & Basic Components",
      "To Node ID": 8,
      "To Node Name": "AI Servers, Racks & System Integration",
      "What flows downstream": "Metals, connectors, cable materials, power components",
      "Why this link exists": "Server chassis, boards, and storage systems consume broad electronic and mechanical inputs.",
      "Direction": "1 -> 8"
    },
    {
      "From Node ID": 1,
      "From Node Name": "Raw Materials, Utilities & Basic Components",
      "To Node ID": 9,
      "To Node Name": "Data Center Physical Infrastructure",
      "What flows downstream": "Electrical equipment materials, building materials, piping, cable",
      "Why this link exists": "Power and cooling infrastructure starts with industrial materials and components.",
      "Direction": "1 -> 9"
    },
    {
      "From Node ID": 2,
      "From Node Name": "Semicap Equipment & Manufacturing Tools",
      "To Node ID": 4,
      "To Node Name": "Wafer Fabrication & Foundry",
      "What flows downstream": "Fab tools and process equipment",
      "Why this link exists": "Foundries need lithography, deposition, etch, and metrology equipment.",
      "Direction": "2 -> 4"
    },
    {
      "From Node ID": 2,
      "From Node Name": "Semicap Equipment & Manufacturing Tools",
      "To Node ID": 5,
      "To Node Name": "Advanced Packaging, OSAT & Test",
      "What flows downstream": "Bonding, dicing, test, and packaging tools",
      "Why this link exists": "Advanced packaging relies on dedicated assembly and inspection tools.",
      "Direction": "2 -> 5"
    },
    {
      "From Node ID": 2,
      "From Node Name": "Semicap Equipment & Manufacturing Tools",
      "To Node ID": 6,
      "To Node Name": "Memory & Storage",
      "What flows downstream": "Memory fab and test equipment",
      "Why this link exists": "HBM/DRAM/NAND production uses similar tool categories with node-specific requirements.",
      "Direction": "2 -> 6"
    },
    {
      "From Node ID": 3,
      "From Node Name": "Chip Architecture, IP & EDA",
      "To Node ID": 4,
      "To Node Name": "Wafer Fabrication & Foundry",
      "What flows downstream": "Tape-outs, masks, process-ready chip designs",
      "Why this link exists": "Foundries manufacture the designs created by chip companies.",
      "Direction": "3 -> 4"
    },
    {
      "From Node ID": 3,
      "From Node Name": "Chip Architecture, IP & EDA",
      "To Node ID": 5,
      "To Node Name": "Advanced Packaging, OSAT & Test",
      "What flows downstream": "Package co-design, chiplet layouts, HBM integration plans",
      "Why this link exists": "Advanced AI chips often require packaging co-design alongside the silicon design.",
      "Direction": "3 -> 5"
    },
    {
      "From Node ID": 4,
      "From Node Name": "Wafer Fabrication & Foundry",
      "To Node ID": 5,
      "To Node Name": "Advanced Packaging, OSAT & Test",
      "What flows downstream": "Processed wafers / dies",
      "Why this link exists": "Wafers move to packaging for assembly, stacking, HBM attachment, and test.",
      "Direction": "4 -> 5"
    },
    {
      "From Node ID": 5,
      "From Node Name": "Advanced Packaging, OSAT & Test",
      "To Node ID": 7,
      "To Node Name": "Networking, Interconnect, Optics & Data Movement",
      "What flows downstream": "Packaged switch ASICs, NICs, DPUs, optical ICs",
      "Why this link exists": "Networking vendors integrate packaged silicon into switches, NICs, and optics.",
      "Direction": "5 -> 7"
    },
    {
      "From Node ID": 5,
      "From Node Name": "Advanced Packaging, OSAT & Test",
      "To Node ID": 8,
      "To Node Name": "AI Servers, Racks & System Integration",
      "What flows downstream": "Packaged GPUs, CPUs, XPUs, accelerators, packaged controllers",
      "Why this link exists": "System builders assemble packaged chips into servers and racks.",
      "Direction": "5 -> 8"
    },
    {
      "From Node ID": 5,
      "From Node Name": "Advanced Packaging, OSAT & Test",
      "To Node ID": 10,
      "To Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "What flows downstream": "Direct accelerator modules / custom packaged silicon",
      "Why this link exists": "Large hyperscalers may source custom packaged silicon directly.",
      "Direction": "5 -> 10"
    },
    {
      "From Node ID": 6,
      "From Node Name": "Memory & Storage",
      "To Node ID": 5,
      "To Node Name": "Advanced Packaging, OSAT & Test",
      "What flows downstream": "HBM stacks and package-adjacent memory components",
      "Why this link exists": "HBM is attached during advanced packaging for AI accelerators.",
      "Direction": "6 -> 5"
    },
    {
      "From Node ID": 6,
      "From Node Name": "Memory & Storage",
      "To Node ID": 7,
      "To Node Name": "Networking, Interconnect, Optics & Data Movement",
      "What flows downstream": "Buffer memory, flash, storage for networking gear",
      "Why this link exists": "Switches and NICs also require memory and local storage.",
      "Direction": "6 -> 7"
    },
    {
      "From Node ID": 6,
      "From Node Name": "Memory & Storage",
      "To Node ID": 8,
      "To Node Name": "AI Servers, Racks & System Integration",
      "What flows downstream": "DRAM, SSDs, memory modules, storage media",
      "Why this link exists": "Servers and storage systems integrate memory and SSD capacity.",
      "Direction": "6 -> 8"
    },
    {
      "From Node ID": 6,
      "From Node Name": "Memory & Storage",
      "To Node ID": 10,
      "To Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "What flows downstream": "Standalone storage systems and memory-intensive platforms",
      "Why this link exists": "Cloud operators also buy storage systems or storage media directly.",
      "Direction": "6 -> 10"
    },
    {
      "From Node ID": 7,
      "From Node Name": "Networking, Interconnect, Optics & Data Movement",
      "To Node ID": 8,
      "To Node Name": "AI Servers, Racks & System Integration",
      "What flows downstream": "NICs, switches, optics, connectors, cable assemblies",
      "Why this link exists": "Server and rack builders integrate network fabrics and high-speed interconnect.",
      "Direction": "7 -> 8"
    },
    {
      "From Node ID": 7,
      "From Node Name": "Networking, Interconnect, Optics & Data Movement",
      "To Node ID": 9,
      "To Node Name": "Data Center Physical Infrastructure",
      "What flows downstream": "Fiber cabling, structured cabling, rack interconnect, power/connectivity components",
      "Why this link exists": "Facility-level network and rack connectivity extend into the physical infrastructure layer.",
      "Direction": "7 -> 9"
    },
    {
      "From Node ID": 7,
      "From Node Name": "Networking, Interconnect, Optics & Data Movement",
      "To Node ID": 10,
      "To Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "What flows downstream": "Network fabrics, switch systems, interconnect solutions",
      "Why this link exists": "Compute owners purchase network infrastructure for cluster scale-out.",
      "Direction": "7 -> 10"
    },
    {
      "From Node ID": 8,
      "From Node Name": "AI Servers, Racks & System Integration",
      "To Node ID": 9,
      "To Node Name": "Data Center Physical Infrastructure",
      "What flows downstream": "Installed racks, server clusters, storage racks",
      "Why this link exists": "System racks are deployed into powered and cooled facilities.",
      "Direction": "8 -> 9"
    },
    {
      "From Node ID": 8,
      "From Node Name": "AI Servers, Racks & System Integration",
      "To Node ID": 10,
      "To Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "What flows downstream": "Finished AI clusters, servers, storage, and rack-scale systems",
      "Why this link exists": "Cloud providers and enterprise compute owners buy deployable systems.",
      "Direction": "8 -> 10"
    },
    {
      "From Node ID": 8,
      "From Node Name": "AI Servers, Racks & System Integration",
      "To Node ID": 12,
      "To Node Name": "Applications & End Users",
      "What flows downstream": "On-prem servers, edge AI appliances, enterprise AI systems",
      "Why this link exists": "Some enterprises and end users buy systems directly rather than consuming cloud services.",
      "Direction": "8 -> 12"
    },
    {
      "From Node ID": 9,
      "From Node Name": "Data Center Physical Infrastructure",
      "To Node ID": 10,
      "To Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "What flows downstream": "Powered/cooled sites, colocation capacity, AI-ready halls",
      "Why this link exists": "Compute owners need the site layer to operate AI clusters.",
      "Direction": "9 -> 10"
    },
    {
      "From Node ID": 9,
      "From Node Name": "Data Center Physical Infrastructure",
      "To Node ID": 12,
      "To Node Name": "Applications & End Users",
      "What flows downstream": "Private AI data centers, enterprise sites, telco/industrial facilities",
      "Why this link exists": "Large end users may deploy private AI infrastructure directly.",
      "Direction": "9 -> 12"
    },
    {
      "From Node ID": 10,
      "From Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "To Node ID": 11,
      "To Node Name": "Foundation Models & AI Platform Layer",
      "What flows downstream": "Training and inference compute, cloud AI services",
      "Why this link exists": "Model developers and AI platforms consume cloud capacity.",
      "Direction": "10 -> 11"
    },
    {
      "From Node ID": 10,
      "From Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "To Node ID": 12,
      "To Node Name": "Applications & End Users",
      "What flows downstream": "Managed AI services, rented compute, cloud software",
      "Why this link exists": "Many enterprises and developers consume AI directly from cloud platforms.",
      "Direction": "10 -> 12"
    },
    {
      "From Node ID": 11,
      "From Node Name": "Foundation Models & AI Platform Layer",
      "To Node ID": 12,
      "To Node Name": "Applications & End Users",
      "What flows downstream": "APIs, copilots, model access, developer tooling, enterprise AI workflows",
      "Why this link exists": "The software/model layer reaches the final demand layer here.",
      "Direction": "11 -> 12"
    }
  ],
  "flowByNode": [
    {
      "Node ID": 1,
      "Node Name": "Raw Materials, Utilities & Basic Components",
      "Outflow To IDs": "2, 4, 5, 6, 7, 8, 9",
      "Outflow To Names": "Semicap Equipment; Foundry; Advanced Packaging; Memory & Storage; Networking/Interconnect; Servers & Racks; Data Center Infrastructure",
      "Typical downstream deliverables": "Materials, components, substrates, cable/fiber inputs, power/building inputs",
      "Comment": "Broadest upstream source node."
    },
    {
      "Node ID": 2,
      "Node Name": "Semiconductor Equipment & Manufacturing Tools",
      "Outflow To IDs": "4, 5, 6",
      "Outflow To Names": "Foundry; Advanced Packaging; Memory & Storage",
      "Typical downstream deliverables": "Manufacturing tools and test/packaging equipment",
      "Comment": "Tool makers enable fab and packaging output."
    },
    {
      "Node ID": 3,
      "Node Name": "Chip Architecture, IP & EDA",
      "Outflow To IDs": "4, 5",
      "Outflow To Names": "Foundry; Advanced Packaging",
      "Typical downstream deliverables": "Tape-outs, IP, package co-design, design files",
      "Comment": "Design sits upstream of manufacturing."
    },
    {
      "Node ID": 4,
      "Node Name": "Wafer Fabrication & Foundry",
      "Outflow To IDs": "5",
      "Outflow To Names": "Advanced Packaging, OSAT & Test",
      "Typical downstream deliverables": "Processed wafers and dies",
      "Comment": "Foundry outflow is mostly to packaging/test."
    },
    {
      "Node ID": 5,
      "Node Name": "Advanced Packaging, OSAT & Test",
      "Outflow To IDs": "7, 8, 10",
      "Outflow To Names": "Networking/Interconnect; Servers & Racks; Cloud/Compute Owners",
      "Typical downstream deliverables": "Packaged accelerators, networking silicon, tested modules",
      "Comment": "Advanced packaging is a bottleneck node for AI."
    },
    {
      "Node ID": 6,
      "Node Name": "Memory & Storage",
      "Outflow To IDs": "5, 7, 8, 10",
      "Outflow To Names": "Advanced Packaging; Networking/Interconnect; Servers & Racks; Cloud/Compute Owners",
      "Typical downstream deliverables": "HBM, DRAM, SSDs, storage media",
      "Comment": "Memory is both parallel and integrated into compute systems."
    },
    {
      "Node ID": 7,
      "Node Name": "Networking, Interconnect, Optics & Data Movement",
      "Outflow To IDs": "8, 9, 10",
      "Outflow To Names": "Servers & Racks; Data Center Infrastructure; Cloud/Compute Owners",
      "Typical downstream deliverables": "Switches, NICs, optics, connectors, cables, network fabrics",
      "Comment": "This is where Amphenol sits most clearly."
    },
    {
      "Node ID": 8,
      "Node Name": "AI Servers, Racks & System Integration",
      "Outflow To IDs": "9, 10, 12",
      "Outflow To Names": "Data Center Infrastructure; Cloud/Compute Owners; Applications & End Users",
      "Typical downstream deliverables": "Servers, racks, storage systems, integrated AI clusters",
      "Comment": "System builders bridge semiconductor outputs to deployed infrastructure."
    },
    {
      "Node ID": 9,
      "Node Name": "Data Center Physical Infrastructure (Power, Cooling, Buildings)",
      "Outflow To IDs": "10, 12",
      "Outflow To Names": "Cloud/Compute Owners; Applications & End Users",
      "Typical downstream deliverables": "Powered/cooled facilities and rack-ready sites",
      "Comment": "Facilities are required before AI clusters can go live."
    },
    {
      "Node ID": 10,
      "Node Name": "Cloud / Hyperscalers, Neo-Clouds & Compute Owners",
      "Outflow To IDs": "11, 12",
      "Outflow To Names": "Foundation Models & AI Platforms; Applications & End Users",
      "Typical downstream deliverables": "Compute capacity, managed AI services, cloud distribution",
      "Comment": "Clouds distribute infrastructure to model builders and enterprises."
    },
    {
      "Node ID": 11,
      "Node Name": "Foundation Models & AI Platform Layer",
      "Outflow To IDs": "12",
      "Outflow To Names": "Applications & End Users",
      "Typical downstream deliverables": "Model APIs, AI platforms, copilots, orchestration",
      "Comment": "Software/model layer reaches users through apps and APIs."
    },
    {
      "Node ID": 12,
      "Node Name": "Applications & End Users",
      "Outflow To IDs": "None (terminal demand in the forward supply chain)",
      "Outflow To Names": null,
      "Typical downstream deliverables": "Terminal demand / adoption layer",
      "Comment": "Forward industrial flow ends here."
    }
  ]
};

