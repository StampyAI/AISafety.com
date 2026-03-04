'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

const tabs = [
  { label: '$1–1,000', key: 'tab1' },
  { label: '$1,000–10,000', key: 'tab2' },
  { label: '$10,000–100,000', key: 'tab3' },
  { label: '$100,000+', key: 'tab4' },
] as const

type TabKey = (typeof tabs)[number]['key']

export default function DonationGuidePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('tab1')
  const [fading, setFading] = useState(false)
  const pendingTab = useRef<TabKey | null>(null)

  function handleTabClick(key: TabKey) {
    if (key === activeTab) return
    pendingTab.current = key
    setFading(true)
    setTimeout(() => {
      setActiveTab(pendingTab.current!)
      pendingTab.current = null
      setFading(false)
    }, 100)
  }

  return (
    <div>
      <div className="container-default">
        <h1 className="padding-top-56px padding-bottom-8px">Donation guide</h1>
        <div className="padding-bottom-40px paragraph-small color-teal-300">
          Last updated: 12 June 2025
        </div>
        <h2 className="width-7-col padding-bottom-56px">
          This guide can help you determine the most effective way to{' '}
          <span className="color-light-teal">
            financially support work on AI safety,
          </span>{' '}
          given the funds and time you have available.
        </h2>
        <p className="padding-bottom-32px">Choose a donation amount:</p>

        <div className={styles.tabsContainer}>
          <div className={`${styles.tabsMenu} width-3-col`}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tabLink} ${activeTab === tab.key ? styles.tabLinkActive : ''}`}
                onClick={() => handleTabClick(tab.key)}
              >
                <p>{tab.label}</p>
              </button>
            ))}
          </div>

          <div
            className={`width-9-col ${styles.tabContent} ${fading ? styles.tabContentFading : ''}`}
          >
            {activeTab === 'tab1' && <Tab1Content />}
            {activeTab === 'tab2' && <Tab2Content />}
            {activeTab === 'tab3' && <Tab3Content />}
            {activeTab === 'tab4' && <Tab4Content />}
          </div>
        </div>
      </div>
    </div>
  )
}

function TimeSection({
  time,
  children,
  last,
}: {
  time: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={`${styles.timeRow} ${last ? styles.timeRowLast : ''}`}>
      <div className="width-3-col">
        <p className="color-teal-300 paragraph-small">If you have</p>
        <p className="paragraph-default-bold">{time}</p>
      </div>
      <div className="width-6-col">{children}</div>
    </div>
  )
}

function Divider() {
  return <div className={styles.divider} />
}

function Tab1Content() {
  return (
    <>
      <h2 className="padding-bottom-24px">$1–1,000 donation</h2>
      <p className="padding-bottom-56px width-7-col">
        AI safety is funding-limited at the moment and every bit counts.
      </p>

      <TimeSection time="5 minutes–1 hour">
        <p className="padding-bottom-12px">
          You can delegate to experienced grantmakers who know of more good
          opportunities than they can fund.
        </p>
        <p>
          Donate to a fund, such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>
          . Grantmakers evaluate projects on behalf of donors and choose the
          projects they think are most effective to fund. Alternatively, you can
          donate to a{' '}
          <Link
            href="https://www.givingwhatwecan.org/donor-lottery"
            target="_blank"
            className="display-inline color-teal"
          >
            donor lottery
          </Link>{' '}
          which gives you a chance to direct a larger amount of money.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="1–50 hours">
        <p className="padding-bottom-12px">
          With some time, you might be able to find good opportunities yourself.
          Otherwise you can delegate to experienced grantmakers.
        </p>
        <p className="padding-bottom-12px">
          Either donate to a fund, such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>
          , donate to a specific project that you think effectively tackles the
          issues of AI safety if you have one in mind, delegate to someone in
          your network if you know someone whose opinion in this area you trust,
          or send money via a{' '}
          <Link
            href="https://www.givingwhatwecan.org/donor-lottery"
            target="_blank"
            className="display-inline color-teal"
          >
            donor lottery
          </Link>{' '}
          to give you a chance to direct a much larger amount and dedicate your
          time to researching where it should go.
        </p>
        <p>
          We recommend exploring{' '}
          <Link
            href="https://manifund.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            Manifund
          </Link>
          , which allows you to &quot;invest&quot; in projects you think will be
          impactful, or nominate regrantors to decide on your behalf.{' '}
          <Link
            href="https://givewiki.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            GiveWiki
          </Link>{' '}
          and the{' '}
          <Link
            href="https://www.nonlinear.org/network.html"
            target="_blank"
            className="display-inline color-teal"
          >
            Nonlinear Network
          </Link>{' '}
          are other platforms where you can choose projects to fund.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="Ongoing commitment">
        <p className="padding-bottom-12px">
          By studying more before donating, you donate not just your money but
          your cognition to find and assess opportunities which big grantmakers
          – who have less time per unit of money – might miss.
        </p>
        <p className="padding-bottom-12px">
          <Link
            href="https://aisafety.info/"
            target="_blank"
            className="display-inline color-white"
          >
            Read up
          </Link>{' '}
          to understand the problem, get involved in the{' '}
          <Link href="/communities" className="display-inline color-white">
            community
          </Link>
          , and fund projects or individuals who you think are doing the best
          work.
        </p>
        <p className="padding-bottom-12px">
          Consider engaging with researchers in the comments sections of their
          research posts on{' '}
          <Link
            href="https://www.lesswrong.com/w/ai"
            target="_blank"
            className="display-inline color-teal"
          >
            LessWrong
          </Link>
          .
        </p>
        <p className="padding-bottom-12px">
          Either donate to a specific project that you think effectively tackles
          the issues of AI safety if you have one in mind, delegate to someone
          in your network if you know someone whose opinions in this area you
          trust, or send money via a{' '}
          <Link
            href="https://www.givingwhatwecan.org/donor-lottery"
            target="_blank"
            className="display-inline color-teal"
          >
            donor lottery
          </Link>{' '}
          to give you a chance to direct a much larger amount and dedicate your
          time to researching where it should go.
        </p>
        <p className="padding-bottom-12px">
          We recommend exploring{' '}
          <Link
            href="https://manifund.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            Manifund
          </Link>
          , which allows you to &quot;invest&quot; in projects you think will be
          impactful, or nominate regrantors to decide on your behalf.{' '}
          <Link
            href="https://givewiki.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            GiveWiki
          </Link>{' '}
          and the{' '}
          <Link
            href="https://www.nonlinear.org/network.html"
            target="_blank"
            className="display-inline color-teal"
          >
            Nonlinear Network
          </Link>{' '}
          are other platforms where you can choose projects to fund.
        </p>
        <p>
          Donating to a fund such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>{' '}
          is a good fallback option.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="Major focus" last>
        <p className="padding-bottom-12px">
          By studying more before you donate, you donate not just your money but
          your cognition to find and assess opportunities which big grantmakers
          – who have less time per unit of money – might miss.
        </p>
        <p className="padding-bottom-12px">
          <Link
            href="https://aisafety.info/"
            target="_blank"
            className="display-inline color-white"
          >
            Read up
          </Link>{' '}
          to understand the problem, get involved in the{' '}
          <Link href="/communities" className="display-inline color-white">
            community
          </Link>
          , and fund projects or individuals who you think are doing the best
          work.
        </p>
        <p className="padding-bottom-12px">
          Consider self-funding to try and{' '}
          <Link
            href="https://aisafety.info/how-can-i-help"
            target="_blank"
            className="display-inline color-teal"
          >
            tackle the problem yourself
          </Link>
          , either directly as a researcher or by using your existing skills to
          support the field.
        </p>
        <p className="padding-bottom-12px">
          Either donate to a specific project that you think effectively tackles
          the issues of AI safety if you have one in mind, delegate to someone
          in your network if you know someone whose opinions in this area you
          trust, or send money via a{' '}
          <Link
            href="https://www.givingwhatwecan.org/donor-lottery"
            target="_blank"
            className="display-inline color-teal"
          >
            donor lottery
          </Link>{' '}
          to give you a chance to direct a much larger amount and dedicate your
          time to researching where it should go.
        </p>
        <p className="padding-bottom-12px">
          We recommend exploring{' '}
          <Link
            href="https://manifund.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            Manifund
          </Link>
          , which allows you to &quot;invest&quot; in projects you think will be
          impactful, or nominate regrantors to decide on your behalf.{' '}
          <Link
            href="https://givewiki.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            GiveWiki
          </Link>{' '}
          and the{' '}
          <Link
            href="https://www.nonlinear.org/network.html"
            target="_blank"
            className="display-inline color-teal"
          >
            Nonlinear Network
          </Link>{' '}
          are other platforms where you can choose projects to fund.
        </p>
        <p>
          Donating to a fund such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>{' '}
          is a good fallback option.
        </p>
      </TimeSection>
    </>
  )
}

function Tab2Content() {
  return (
    <>
      <h2 className="padding-bottom-24px">$1,000 – 10,000 donation</h2>
      <p className="padding-bottom-56px width-7-col">
        AI safety is funding-limited at the moment and notable donations can
        make a big difference.
      </p>

      <TimeSection time="5 minutes–1 hour">
        <p className="padding-bottom-12px">
          You can delegate to experienced grantmakers who know of more good
          opportunities than they can fund.
        </p>
        <p>
          Donate to a fund, such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>
          . Grantmakers evaluate projects on behalf of donors and choose the
          projects they think are most effective to fund.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="1–50 hours">
        <p className="padding-bottom-12px">
          With some time, you might be able to find good opportunities yourself,
          otherwise you can delegate to experienced grantmakers.
        </p>
        <p className="padding-bottom-12px">
          Either donate to a fund, such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>
          , donate to specific projects that you think effectively tackle the
          issues of AI safety if you have some in mind, delegate to someone in
          your network if you know someone whose opinions in this area you
          trust, or send money via a{' '}
          <Link
            href="https://www.givingwhatwecan.org/donor-lottery"
            target="_blank"
            className="display-inline color-teal"
          >
            donor lottery
          </Link>{' '}
          to give you a chance to direct a much larger amount and dedicate your
          time to researching where it should go.
        </p>
        <p>
          We recommend exploring{' '}
          <Link
            href="https://manifund.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            Manifund
          </Link>
          , which allows you to &quot;invest&quot; in projects you think will be
          impactful, or nominate regrantors to decide on your behalf.{' '}
          <Link
            href="https://givewiki.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            GiveWiki
          </Link>{' '}
          and the{' '}
          <Link
            href="https://www.nonlinear.org/network.html"
            target="_blank"
            className="display-inline color-teal"
          >
            Nonlinear Network
          </Link>{' '}
          are other platforms where you can choose projects to fund.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="Ongoing commitment">
        <p className="padding-bottom-12px">
          By studying more before donating, you donate not just your money but
          your cognition to find and assess opportunities which big grantmakers
          – who have less time per unit of money – might miss.
        </p>
        <p className="padding-bottom-12px">
          <Link
            href="https://aisafety.info/"
            target="_blank"
            className="display-inline color-white"
          >
            Read up
          </Link>{' '}
          to understand the problem, get involved in the{' '}
          <Link href="/communities" className="display-inline color-teal">
            community
          </Link>
          , and fund projects or individuals who you think are doing the best
          work.
        </p>
        <p className="padding-bottom-12px">
          Consider engaging with researchers in the comments sections of their
          research posts on{' '}
          <Link
            href="https://www.lesswrong.com/w/ai"
            target="_blank"
            className="display-inline color-teal"
          >
            LessWrong
          </Link>
          .
        </p>
        <p className="padding-bottom-12px">
          Either donate to a specific project that you think effectively tackles
          the issues of AI safety if you have one in mind, delegate to someone
          in your network if you know someone whose opinions in this area you
          trust, or send money via a{' '}
          <Link
            href="https://www.givingwhatwecan.org/donor-lottery"
            target="_blank"
            className="display-inline color-teal"
          >
            donor lottery
          </Link>{' '}
          to give you a chance to direct a much larger amount and dedicate your
          time to researching where it should go.
        </p>
        <p className="padding-bottom-12px">
          We recommend exploring{' '}
          <Link
            href="https://manifund.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            Manifund
          </Link>
          , which allows you to &quot;invest&quot; in projects you think will be
          impactful, or nominate regrantors to decide on your behalf.{' '}
          <Link
            href="https://givewiki.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            GiveWiki
          </Link>{' '}
          and the{' '}
          <Link
            href="https://www.nonlinear.org/network.html"
            target="_blank"
            className="display-inline color-teal"
          >
            Nonlinear Network
          </Link>{' '}
          are other platforms where you can choose projects to fund.
        </p>
        <p>
          Donating to a fund such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>{' '}
          is a good fallback option.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="Major focus" last>
        <p className="padding-bottom-12px">
          By studying more before you donate, you donate not just your money but
          your cognition to find and assess opportunities which big grantmakers
          – who have less time per unit of money – might miss.
        </p>
        <p className="padding-bottom-12px">
          <Link
            href="https://aisafety.info/"
            target="_blank"
            className="display-inline color-teal"
          >
            Read up
          </Link>{' '}
          to understand the problem, get involved in the{' '}
          <Link href="/communities" className="display-inline color-teal">
            community
          </Link>
          , and fund projects or individuals who you think are doing the best
          work.
        </p>
        <p className="padding-bottom-12px">
          Consider self-funding to try and{' '}
          <Link
            href="https://aisafety.info/how-can-i-help"
            target="_blank"
            className="display-inline color-white"
          >
            tackle the problem yourself
          </Link>
          , either directly as a researcher or by using your existing skills to
          support the field.
        </p>
        <p className="padding-bottom-12px">
          Either donate to a specific project that you think effectively tackles
          the issues of AI safety if you have one in mind, delegate to someone
          in your network if you know someone whose opinions in this area you
          trust, or send money via a{' '}
          <Link
            href="https://www.givingwhatwecan.org/donor-lottery"
            target="_blank"
            className="display-inline color-teal"
          >
            donor lottery
          </Link>{' '}
          to give you a chance to direct a much larger amount and dedicate your
          time to researching where it should go.
        </p>
        <p className="padding-bottom-12px">
          We recommend exploring{' '}
          <Link
            href="https://manifund.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            Manifund
          </Link>
          , which allows you to &quot;invest&quot; in projects you think will be
          impactful, or nominate regrantors to decide on your behalf.{' '}
          <Link
            href="https://givewiki.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            GiveWiki
          </Link>{' '}
          and the{' '}
          <Link
            href="https://www.nonlinear.org/network.html"
            target="_blank"
            className="display-inline color-teal"
          >
            Nonlinear Network
          </Link>{' '}
          are other platforms where you can choose projects to fund.
        </p>
        <p>
          Donating to a fund such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>{' '}
          is a good fallback option.
        </p>
      </TimeSection>
    </>
  )
}

function Tab3Content() {
  return (
    <>
      <h2 className="padding-bottom-24px">$10,000–100,000 donation</h2>
      <p className="padding-bottom-56px width-7-col">
        At this scale of donation, you could enable grantmakers to support
        someone working on AI safety full-time, or provide significant support
        to an organization.
      </p>

      <TimeSection time="5 minutes–1 hour">
        <p>
          Donate to a fund, such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>
          . Grantmakers evaluate projects on behalf of donors and choose the
          projects they think are most effective to fund.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="1–50 hours">
        <p className="padding-bottom-12px">
          Either donate to a fund, such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>
          , donate to specific projects that you think effectively tackle the
          issues of AI safety if you have some in mind, delegate to someone in
          your network if you know someone whose opinions in this area you
          trust, or send money via a{' '}
          <Link
            href="https://www.givingwhatwecan.org/donor-lottery"
            target="_blank"
            className="display-inline color-teal"
          >
            donor lottery
          </Link>{' '}
          to give you a chance to direct a much larger amount and dedicate your
          time to researching where it should go.
        </p>
        <p>
          We recommend exploring{' '}
          <Link
            href="https://manifund.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            Manifund
          </Link>
          , which allows you to &quot;invest&quot; in projects you think will be
          impactful, or nominate regrantors to decide on your behalf.{' '}
          <Link
            href="https://givewiki.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            GiveWiki
          </Link>{' '}
          and the{' '}
          <Link
            href="https://www.nonlinear.org/network.html"
            target="_blank"
            className="display-inline color-teal"
          >
            Nonlinear Network
          </Link>{' '}
          are other platforms where you can choose projects to fund.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="Ongoing commitment">
        <p className="padding-bottom-12px">
          <Link
            href="https://aisafety.info/"
            target="_blank"
            className="display-inline color-teal"
          >
            Read up
          </Link>{' '}
          to understand the problem, get involved in the{' '}
          <Link href="/communities" className="display-inline color-teal">
            community
          </Link>
          , and fund projects or individuals who you think are doing the best
          work.
        </p>
        <p className="padding-bottom-12px">
          Consider engaging with researchers in the comments sections of their
          research posts on{' '}
          <Link
            href="https://www.lesswrong.com/w/ai"
            target="_blank"
            className="display-inline color-teal"
          >
            LessWrong
          </Link>
          .
        </p>
        <p>
          Donating to a fund such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>{' '}
          is a good fallback option.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="Major focus" last>
        <p className="padding-bottom-12px">
          <Link
            href="https://aisafety.info/"
            target="_blank"
            className="display-inline color-teal"
          >
            Read up
          </Link>{' '}
          to understand the problem, get involved in the{' '}
          <Link href="/communities" className="display-inline color-teal">
            community
          </Link>
          , and fund projects or individuals who you think are doing the best
          work.
        </p>
        <p className="padding-bottom-12px">
          Consider self-funding to try and tackle the problem yourself, either
          directly as a researcher or by using your existing skills to support
          the field.
        </p>
        <p>
          Donating to a fund such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>{' '}
          is a good fallback option.
        </p>
      </TimeSection>
    </>
  )
}

function Tab4Content() {
  return (
    <>
      <h2 className="padding-bottom-24px">$100,000+ donation</h2>
      <p className="padding-bottom-56px width-7-col">
        You can provide significant support to several organizations, and could
        also support many full-time researchers. The total funding for AI safety
        was around $150 million in 2023; you can be a notable fraction of the
        funding ecosystem if you care and can dedicate the funds.
      </p>

      <TimeSection time="5 minutes–1 hour">
        <p>
          Either delegate to someone in your network who you think has a good
          understanding of the challenge (possibly by sponsoring them as an{' '}
          <Link
            href="https://survivalandflourishing.fund/s-process.html"
            target="_blank"
            className="display-inline color-teal"
          >
            S-process recommender
          </Link>
          , which will give them infrastructure and a menu of applications), or
          donate to a fund such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>{' '}
          where grantmakers evaluate projects on behalf of donors.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="1–50 hours">
        <p className="padding-bottom-12px">
          Some high impact ideas include sponsoring an{' '}
          <Link
            href="https://survivalandflourishing.fund/s-process.html"
            target="_blank"
            className="display-inline color-teal"
          >
            S-process recommender
          </Link>{' '}
          whose judgment you trust, which will give them infrastructure and a
          menu of applications, or donate to a{' '}
          <Link
            href="https://www.givingwhatwecan.org/donor-lottery"
            target="_blank"
            className="display-inline color-teal"
          >
            donor lottery
          </Link>{' '}
          which can amplify your donation.
        </p>
        <p>
          Alternatively, either donate to a fund – such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>{' '}
          – or to specific projects that you think effectively tackle the issues
          of AI safety, or select individuals to donate to directly. We
          recommend exploring{' '}
          <Link
            href="https://manifund.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            Manifund
          </Link>
          , which allows you to &quot;invest&quot; in projects you think will be
          impactful, or nominate regrantors to decide on your behalf.{' '}
          <Link
            href="https://givewiki.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            GiveWiki
          </Link>{' '}
          and the{' '}
          <Link
            href="https://www.nonlinear.org/network.html"
            target="_blank"
            className="display-inline color-teal"
          >
            Nonlinear Network
          </Link>{' '}
          are similar platforms where you can choose projects to fund.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="Ongoing commitment">
        <p className="padding-bottom-12px">
          <Link
            href="https://aisafety.info/"
            target="_blank"
            className="display-inline color-teal"
          >
            Read up
          </Link>{' '}
          to understand the problem, get involved in the{' '}
          <Link href="/communities" className="display-inline color-teal">
            community
          </Link>
          , and fund projects or individuals who you think are doing the best
          work.
        </p>
        <p className="padding-bottom-12px">
          Consider engaging with researchers in the comments sections of their
          research posts{' '}
          <Link
            href="https://www.lesswrong.com/w/ai"
            target="_blank"
            className="display-inline color-teal"
          >
            LessWrong
          </Link>
          .
        </p>
        <p>
          Alternatively, either donate to a fund – such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>{' '}
          – or to specific projects that you think effectively tackle the issues
          of AI safety, or select individuals to donate to directly. We
          recommend exploring{' '}
          <Link
            href="https://manifund.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            Manifund
          </Link>
          , which allows you to &quot;invest&quot; in projects you think will be
          impactful.
        </p>
      </TimeSection>

      <Divider />

      <TimeSection time="Major focus" last>
        <p className="padding-bottom-12px">
          <Link
            href="https://aisafety.info/"
            target="_blank"
            className="display-inline color-teal"
          >
            Read up
          </Link>{' '}
          to understand the problem, get involved in the{' '}
          <Link href="/communities" className="display-inline color-teal">
            community
          </Link>
          , and fund projects or individuals who you think are doing the best
          work.
        </p>
        <p className="padding-bottom-12px">
          Consider self-funding to try and tackle the problem yourself, either
          directly as a researcher or by using your existing skills to support
          the field. You can also skill up to improve your abilities as a
          grantmaker.
        </p>
        <p className="padding-bottom-12px">
          Consider engaging with researchers in the comments sections of their
          research posts on{' '}
          <Link
            href="https://www.lesswrong.com/w/ai"
            target="_blank"
            className="display-inline color-teal"
          >
            LessWrong
          </Link>
          .
        </p>
        <p className="padding-bottom-12px">
          Some high impact ideas for donating include sponsoring an{' '}
          <Link
            href="https://survivalandflourishing.fund/s-process.html"
            target="_blank"
            className="display-inline color-teal"
          >
            S-process recommender
          </Link>{' '}
          whose judgment you trust, which will give them infrastructure and a
          menu of applications, or donate to a{' '}
          <Link
            href="https://www.givingwhatwecan.org/donor-lottery"
            target="_blank"
            className="display-inline color-teal"
          >
            donor lottery
          </Link>{' '}
          which can amplify your donation.
        </p>
        <p>
          Alternatively, either donate to a fund – such as the{' '}
          <Link
            href="https://www.airiskfund.com/"
            target="_blank"
            className="display-inline color-teal"
          >
            AI Risk Mitigation Fund
          </Link>{' '}
          – or to specific projects that you think effectively tackle the issues
          of AI safety, or select individuals to donate to directly. We
          recommend exploring{' '}
          <Link
            href="https://manifund.org/"
            target="_blank"
            className="display-inline color-teal"
          >
            Manifund
          </Link>
          , which allows you to &quot;invest&quot; in projects you think will be
          impactful.
        </p>
      </TimeSection>
    </>
  )
}
