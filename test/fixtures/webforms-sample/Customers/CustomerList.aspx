<%@ Page Language="C#" MasterPageFile="~/Site.master" AutoEventWireup="true" CodeBehind="CustomerList.aspx.cs" Inherits="WebFormsSample.Customers.CustomerList" %>
<%@ Register TagPrefix="uc1" TagName="SearchBox" Src="~/Controls/SearchBox.ascx" %>
<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">
    <uc1:SearchBox ID="search1" runat="server" />
    <a href="CustomerDetail.aspx">View customer</a>
</asp:Content>
